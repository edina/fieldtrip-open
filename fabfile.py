"""
Copyright (c) 2014, EDINA,
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
"""

from email.mime.text import MIMEText

from fabric.api import cd, env, execute, hosts, lcd, local, put, run, settings, task
from fabric.contrib.files import exists
from fabric.contrib.project import rsync_project
from jinja2 import Environment, PackageLoader, FileSystemLoader
from bs4 import BeautifulSoup

import xml.etree.ElementTree as ET

import codecs
import ConfigParser
import json
import os
import smtplib
import re, itertools
import collections


CORDOVA_VERSION   = '3.3.1-0.4.2'
OPENLAYERS_VERSION = '2.12'
PROJ4JS_VERSION    = '1.1.0'

config = None

@task
def clean():
    """
    Tidy up app. This should be run before switching projects.
    """
    root, project, src = _get_source()

    def delete_repo(repo):
        if os.path.exists(repo):
            with lcd(repo):
                out = local('git status', capture=True)
                if len(out.splitlines()) > 2:
                    print "\nWon't delete {0} until there are no uncommitted changes".format(repo)
                    exit(-1)
                else:
                    local('rm -rf {0}'.format(repo))

    with settings(warn_only=True):
        www = os.sep.join((src, 'www'))
        local('rm {0}*.html'.format(os.sep.join((www, ''))))
        local('rm {0}'.format(os.sep.join((www, 'theme'))))
        local('rm {0}'.format(os.sep.join((root, 'etc', 'config.ini'))))

    with lcd(root):
        if os.path.exists('project'):
            proj_repo = local('readlink project', capture=True)
            print proj_repo
            delete_repo(os.sep.join((root, proj_repo)))
            local('rm project')

    plugins = os.sep.join((root, 'plugins'))
    if os.path.exists(plugins):
        with lcd(plugins):
            for plugin in os.listdir(plugins):
                delete_repo(os.sep.join((plugins, plugin)))
        local('rmdir plugins')

@task
def deploy_android():
    """
    Deploy to android device connected to machine
    """

    _check_command('ant')
    _check_command('adb')
    _check_command('cordova')
    _check_command('android')

    # generate html for android
    generate_html(cordova=True)

    with lcd(_get_runtime()[1]):
        device = None
        local('cordova build')

        with settings(warn_only=True):
            cmd = 'cordova run android 2>&1'
            out = local(cmd, capture=True)

            if out and out.find('INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES') != -1:
                # app is installed with wrong certificate try and uninstall app
                local('adb uninstall {0}'.format(_config('package')))

                # retry install
                local(cmd)

@task
def deploy_ios():
    """
    Deploy to ios device connected to machine
    """
    # TODO
    print 'Waiting for someone to do this.'

@task
def generate_docs():
    """
    Auto generate javascript markdown documentation
    """

    local('jsdox --output docs/ src/www/js/')

@task
def generate_html(platform="android", cordova=False):
    """
    Generate html from templates

    platform - android or ios
    cordova - should cordova.js be used?
    """
    if isinstance(cordova, basestring):
        cordova = str2bool(cordova)
    root, proj_home, src_dir = _get_source()
    path = os.sep.join((src_dir, 'templates'))
    export_path = os.sep.join((src_dir, 'www'))
    templates_path = os.path.join(proj_home, 'src', 'templates')

    def _do_merge(filename, data, path):
        if os.path.exists(path) and filename in os.listdir(path):
            with open(os.path.join(path, filename), 'r') as f:
                new_data = json.load(f, object_pairs_hook=collections.OrderedDict)
            return _merge(data, new_data)
        else:
            return data

    def _get_data(path1, filename, path2):
        with open(os.path.join(path1, filename),'r') as f:
            return _do_merge(filename, json.load(f, object_pairs_hook=collections.OrderedDict), path2)

    def _get_header_footer_data(path, templates_path):
        environ = Environment(loader=FileSystemLoader(path))
        environ.globals["_get_letter"] = _get_letter

        header_data = _get_data(path, 'header.json', templates_path)
        footer_data = _get_data(path, 'footer.json', templates_path)

        header_template = environ.get_template("header.html")
        footer_template = environ.get_template("footer.html")
        return header_data, footer_data, header_template, footer_template

    def _generate_templates(environ, templates):
        for templ in templates:
            print "generating template {0}".format(templates[templ])
            script_template = environ.get_template(templates[templ])
            _write_data(os.path.join(export_path, 'templates', templates[templ]), script_template.render())

    def _create_html(path1, path2, header_data, footer_data, header_template, footer_template):
        environ = Environment(loader=FileSystemLoader(path1))
        environ.globals["_get_letter"] = _get_letter
        #environ.globals["_sorted"] = _sorted

        for path, dirs, files in os.walk(path1):
            for f in files:
                if f.endswith("json") and not f.startswith("header") and not f.startswith("footer"):
                    htmlfile = '{0}.html'.format(f.split(".")[0])
                    htmlfilepath = os.path.join(path, htmlfile)
                    jsonfilepath = os.path.join(path, f)

                    data = _get_data(path, f, path2)
                    #generate templates:
                    if "templates" in data:
                        _generate_templates(environ, data["templates"])

                    if os.path.exists(htmlfilepath):
                        print "generating file {0}".format(htmlfile)

                        if "header" in data:
                            _merge(data["header"], header_data, path2)
                        else:
                            data["header"] = header_data

                        if "footer" in data:
                            _merge(data["footer"], footer_data, path2)
                        else:
                            data["footer"] = footer_data

                        if "body" in data:
                            body = _sorted(data["body"])
                        else:
                            body=""

                        template = environ.get_template(htmlfile)
                        indexheader_data = {"cordova": cordova, "title": header_data["title"]}

                        popups=[]
                        if "popups" in data:
                            for popup in data["popups"]:
                                popup_template = environ.get_template(data["popups"][popup]["template"])
                                popups.append(popup_template.render(data=data["popups"][popup]["data"]))

                        output = template.render(
                            header_data=indexheader_data,
                            body=body,
                            popups="\n".join(popups),
                            platform=platform,
                            header=header_template.render(
                                data=data["header"],
                                platform=platform),
                                footer=footer_template.render(
                                    data=data["footer"],
                                    platform=platform))
                        _write_data(os.sep.join((export_path, htmlfile)), _prettify(output, 2))

    header_data, footer_data, header_template, footer_template = _get_header_footer_data(path, templates_path)
    _create_html(path, templates_path, header_data, footer_data, header_template, footer_template)
    _create_html(templates_path, path, header_data, footer_data, header_template, footer_template)

    with open(os.path.join(src_dir, 'www', 'theme', 'plugins.json'),'r') as f:
        plgins = json.load(f)
        for d in os.listdir(os.path.join(root, 'plugins')):
            d1 = os.path.join(root, 'plugins', d)
            for dire in os.listdir(d1):
                if os.path.isdir(os.path.join(d1, dire)) and not dire.startswith("."):
                    _create_html(os.path.join(d1, dire, 'src', 'templates'), path, header_data, footer_data, header_template, footer_template)

@task
def install_plugins(target='local', cordova="True"):
    """
    Set up project plugins

    target - runtime root
    cordova - flag to switch on/off fetching of cordova plugins
    """

    runtime = _get_runtime(target)[1]
    root, proj_home, src_dir = _get_source()
    asset_dir =  os.sep.join((src_dir, 'www'))
    theme = os.sep.join((asset_dir, 'theme'))

    with settings(warn_only=True):
        # remove old sym links
        local('rm -r {0}/plugins/*'.format(asset_dir))

    with lcd(root):
        if not os.path.exists('plugins'):
            local('mkdir plugins')

    # process project json file
    json_file = os.sep.join((theme, 'plugins.json'))
    if os.path.exists(json_file):
        pobj = json.loads(open(json_file).read())

        if _str2bool(cordova):
            with lcd(runtime):
                # do cordova plugins
                for name in pobj['cordova']:
                    local('cordova plugin add {0}'.format(name))

        # do fieldtrip plugins
        proot = os.sep.join((root, 'plugins'))
        for plugin, details in pobj['fieldtrip'].iteritems():
            dest = os.sep.join((asset_dir, 'plugins', plugin))
            if not details[0:3] == 'git':
                # bower plugin
                name = 'fieldtrip-{0}'.format(plugin)
                local('bower install {0}#{1}'.format(name, details))
                local('mkdir {0}'.format(dest))
                src = os.sep.join((root, 'bower_components', name, 'src', 'www'))
                local('cp -r {0}/* {1}'.format(src, dest))
            else:
                # git repository
                src = os.sep.join((proot, plugin))
                if not os.path.isdir(src):
                    with lcd(proot):
                        local('git clone {0} {1}'.format(details, plugin))

                www = os.sep.join((proot, plugin, 'src', 'www'))
                if os.path.exists(www):
                    # create sym link to repos www dir
                    local('ln -s {0} {1}'.format(www, dest))
                else:
                    print 'Plugin has no www dir: {0}'.format(www)
                    exit(-1)
    else:
        print 'Where is the plugins file?: {0}'.format(json_file)
        exit(-1)

@task
def install_project(platform='android',
                    dist_dir='apps',
                    target='local'):
    """
    Install Cordova runtime

    platform - android or ios
    dist_dir - directory for unpacking openlayers
    target - runtime root
    """

    if platform == 'android':
        _check_command('android')
        _check_command('ant')
    _check_command('cordova')

    root, proj_home, src_dir = _get_source()

    # get config file
    _check_config()

    target_dir, runtime = _get_runtime(target)
    js_ext_dir = os.sep.join(('www', 'js', 'ext'))
    css_dir = os.sep.join(('www', 'css', 'ext'))

    # create config.xml
    environ = Environment(loader=FileSystemLoader('etc'))
    config_template = environ.get_template("config.xml")
    filedata = config_template.render(name=_config('name'),
                           package=_config('package'),
                           version=_config('version'),
                           version_code=_config('version').replace(".", ""),
                           author_email=_config('author_email'),
                           url=_config('url'),
                           access_urls = _config('access_urls').split(","))
    _write_data(os.sep.join((src_dir, 'www', 'config.xml')), filedata)

    if os.path.exists(runtime):
        # check if they want to delete existing installation
        msg = 'Directory {0} exists.\nDo you wish to delete it(Y/n)? > '.format(runtime)
        answer = raw_input(msg).strip()

        if len(answer) > 0 and answer != 'y':
            print 'Choosing not continue. Nothing installed.'
            return

        local('rm -rf {0}'.format(runtime))
    else:
        os.mkdir(runtime)

    if not os.path.exists('project'):
        proj = _config('project')
        pro_name = proj[proj.rfind('/') + 1:].replace('.git', '')
        local('git clone {0}'.format(proj))
        local('ln -s {0} {1}'.format(pro_name, 'project'))

    # do some checks on the project
    theme_src = os.sep.join((proj_home, 'theme'))
    if not os.path.exists(os.sep.join((theme_src, 'plugins.json'))):
        print "\n*** WARNING: No plugins.json found in project"
    theme_css = os.sep.join((theme_src, 'css'))
    if not os.path.exists(os.sep.join((theme_css, 'jqm-style.css'))):
        print "\n*** WARNING: No jqm-style.css found in project: {0}".format(theme_css)
    if not os.path.exists(os.sep.join((theme_css, 'style.css'))):
        print "\n*** WARNING: No style.css found in project"

    # install external js libraries
    local('bower install')
    bower = json.loads(open('bower.json').read())
    bower_home = os.sep.join((root, 'bower_components'))

    # install cordova
    with lcd(target_dir):
        local('cordova create {0} {1} {1}'.format(
            runtime,
            _config('package'),
            _config('name')))

    with lcd(runtime):

        # add platform and cordova plugins
        local('cordova platform add {0}'.format(platform))

        # create sym link to assets
        local('rm -rf www')
        asset_dir =  os.sep.join((src_dir, 'www'))
        local('ln -s {0}'.format(asset_dir))

        # link to project theme
        theme = os.sep.join((asset_dir, 'theme'))
        if not os.path.exists(theme):
            with lcd(asset_dir):
                if os.path.exists(theme_src):
                    local('ln -s {0} theme'.format(theme_src))
                else:
                    print '\nYour project must have a theme at {0}'.format(theme_src)
                    exit(-1)

        # clean up old installs
        with settings(warn_only=True):
            local('rm {0}/*'.format(js_ext_dir))
            local('rm {0}/*.css'.format(css_dir))
            local('rm {0}/plugins/*'.format(asset_dir))

        # set up bower dependecies
        for dep in bower['dependency_locations']:
            files = bower['dependency_locations'][dep]
            version = bower['dependencies'][dep]
            for f in files:
                f = f.replace('x.x', version)
                src = os.sep.join((bower_home, dep, f))
                f_name = dep.replace('-bower', '')
                if f[len(f) - 2:] == 'js':
                    dest = os.sep.join((js_ext_dir, '{0}.js'.format(f_name)))
                else:
                    dest = os.sep.join((css_dir, '{0}.css'.format(f_name)))
                local('cp {0} {1}'.format(src, dest))

    # generate config js
    values = dict(config.items('app'))
    templates = os.sep.join((src_dir, 'templates'))
    out_file = os.sep.join((src_dir, 'www', 'js', 'config.js'))
    environ = Environment(loader=FileSystemLoader(templates))
    template = environ.get_template("config.js")
    output = template.render(config=values)
    _write_data(out_file, output)

    # set up cordova/fieldtrip plugins
    install_plugins(target)

    # add project specific files
    update_app()

    # process tempates
    generate_html()

    # check if /home/<user>/<dist_dir> exists
    dist_path = os.sep.join((os.environ['HOME'], dist_dir))
    if not os.path.exists(dist_path):
        os.makedirs(dist_path)

    # install proj4js
    proj4js_path = os.sep.join((dist_path, 'proj4js'))
    if not os.path.exists(proj4js_path):
        with lcd(dist_path):
            local('wget http://download.osgeo.org/proj4js/proj4js-{0}.zip'.format(PROJ4JS_VERSION))
            local('unzip proj4js-{0}.zip'.format(PROJ4JS_VERSION))

    with lcd(runtime):
        # copy it to ext folder
        local('cp {0} {1}'.format(os.sep.join((proj4js_path, 'lib', 'proj4js-compressed.js')),
                                  os.sep.join((js_ext_dir, 'proj4js.js'))))

    # check if openlayers is installed
    ol_dir = 'OpenLayers-%s' % OPENLAYERS_VERSION
    ol_path = os.sep.join((dist_path, ol_dir))

    if not os.path.exists(ol_path):
        # install openlayers
        with lcd(dist_path):
            ol_tar_file_name = '%s.tar.gz' % ol_dir
            ol_tar = 'http://openlayers.org/download/%s' % ol_tar_file_name
            local('wget %s' % ol_tar)
            local('tar xvfz %s' % ol_tar_file_name)

    with lcd(os.sep.join((ol_path, 'build'))):
        cfg_file = os.sep.join((src_dir, 'etc', 'openlayers-mobile.cfg'))
        js_mobile = os.sep.join((runtime, js_ext_dir, 'openlayers.js'))
        local('./build.py %s %s' % (cfg_file, js_mobile))

@task
def release_android(beta='True', overwrite='False', email=False):
    """
    Release android version of fieldtrip app

    beta - BETA release or LIVE?
    overwrite - should current apk file be overwitten?
    email - send email to ftgb mailing list?
    """

    root, proj_home, src_dir = _get_source()
    _check_config()
    runtime = _get_runtime()[1];

    update_app()

    # get app version
    tree = ET.parse(os.sep.join((runtime, 'platforms', 'android', 'AndroidManifest.xml')))
    namespace = "{http://schemas.android.com/apk/res/android}"
    root = tree.getroot()
    version = root.attrib['{0}versionName'.format(namespace)]

    # update utils.js with app version
    utils = os.sep.join((_get_source()[1], 'assets', 'www', 'js', 'utils.js'))
    f = open(utils, 'r')
    file_str = f.read()
    f.close()
    file_str = re.sub(r'version\': \'[0-9]\.[0-9]\..+',
                      "version': '{0}'".format(version),
                      file_str)
    f = open(utils, 'w')
    f.write(file_str)
    f.close()

    with lcd(runtime):
        bin_dir = os.sep.join((runtime, 'platforms', 'android', 'bin'))
        apk_name = _config('package').replace('.', '')

        # do the build
        if _str2bool(beta):
            file_name = '{0}-debug.apk'.format(apk_name)
            new_file_name = '{0}-debug.apk'.format(_config('name'))
            local('cordova build')
        else:
            file_name = '{0}.apk'.format(apk_name)
            new_file_name = '{0}.apk'.format(_config('name'))
            with lcd(os.sep.join((runtime, 'platforms', 'android'))):
                local('ant clean release')

            # sign the application
            unsigned_apkfile = os.sep.join((bin_dir, '{0}-release-unsigned.apk'.format(apk_name)))
            #unsigned_apkfile = os.sep.join((bin_dir, '{0}-release-unaligned.apk'.format(name)))
            signed_apkfile = os.sep.join((bin_dir, '{0}-release-signed.apk'.format(apk_name)))
            local('cp {0} {1}'.format(unsigned_apkfile, signed_apkfile))
            keystore = _config('keystore', section='release')

            if keystore.find('@') != -1:
                # if keystore is stored remotely copy it locally
                ks_name = keystore[keystore.rfind('/') + 1: len(keystore)]
                keystore_local = os.sep.join((src_dir, 'etc', ks_name))
                local('scp {0} {1}'.format(keystore, keystore_local))
                keystore = keystore_local

            local('jarsigner -verbose -sigalg MD5withRSA -digestalg SHA1 -keystore {0} {1} {2}'.format(
                keystore,
                signed_apkfile,
                _config('name')))

            # align the apk file
            apkfile = os.sep.join((bin_dir, file_name))
            local('zipalign -v 4 {0} {1}'.format(signed_apkfile, apkfile))

    # copy apk to servers, if defined
    hosts = _config('hosts', section='release')
    env.hosts = _config('hosts', section='release').split(',')
    if len(env.hosts) > 0:
        execute('_copy_apk_to_servers',
                version,
                file_name,
                new_file_name,
                _str2bool(overwrite))

    # inform of release
    if email:
        _email(new_file_name, version, beta)

@task
def release_ios():
    """
    Release ios version of fieldtrip app
    """

    # TODO
    print 'Waiting for someone to do this.'

@task
def update_app():
    """Update app with latest configuration"""
    proj_home = _get_source()[1]
    runtime = _get_runtime()[1]

    platforms = os.sep.join((proj_home, 'platforms'))

    if os.path.exists(platforms):
        local('cp -rf {0} {1}'.format(platforms,
                                      runtime))
    else:
        print "\nProject has no platforms directory: {0}".format(platforms)
        exit(-1)

def _check_command(cmd):
    """checks a command is in the path"""
    with settings(warn_only=True):
        out = local('command -v {0}'.format(cmd), capture=True)
        if out.return_code != 0:
            print '{0} needs to be installed and in your path'.format(cmd)
            exit(0)

    if cmd == 'cordova':
        version = local('cordova -v', capture=True).strip();
        if version != CORDOVA_VERSION:
            _check_command('npm')
            local('npm install -g cordova@{0}'.format(CORDOVA_VERSION))

def _check_config():
    """
    If config.ini exists update from remote location, otherwise prompt user for location
    """
    global config

    root = _get_source()[0]
    conf_dir = os.sep.join((root, 'etc'))
    conf_file = os.sep.join((conf_dir, 'config.ini'))
    if not os.path.exists(conf_file):
        msg = '\nProvide location of config file > '
        answer = raw_input(msg).strip()
        if len(answer) > 0:
            if answer.find('@') == -1:
                if os.path.exists(answer):
                    local('cp {0} {1}'.format(answer, conf_file))
                else:
                    print "File not found, can't continue."
                    exit(0)
            else:
                local('scp {0} {1}'.format(answer, conf_dir))

    # pick up any changes from remote config
    location = _config('location')
    if location.find('@') != -1:
        local('rsync -avz {0} {1}'.format(location, conf_dir))
        config = None # make sure it is re-read

def _config(key, section='install'):
    """
    Get config value for key.

    key - config key
    section - config section, e.g install, release or app
    """

    global config
    if config == None:
        config = ConfigParser.ConfigParser()
        conf_file = os.sep.join((_get_source()[0], 'etc', 'config.ini'))
        config.read(conf_file)

    return config.get(section, key)

def _copy_apk_to_servers(version, file_name, new_file_name, overwrite):
    """
    Copy APK file to servers

    version - app version
    file_name - apk file name, as generated from build
    new_file_name - the new, user friendly, name for the apk file
    overwrite - should current apk file be overwitten?
    """

    runtime = _get_runtime()[1];
    apk = os.sep.join((runtime, 'platforms', 'android', 'bin', file_name))

    # copy to server
    target_dir = '{0}/{1}'.format(_config('dir', section='release'), version)
    if not exists(target_dir):
        run('mkdir {0}'.format(target_dir))

    target_file = os.sep.join((target_dir, file_name))
    if exists(target_file) and not overwrite:
        print '\nVersion {0} already exists at {1}'.format(version, target_file)
        print '*** Unable to release to {0} ***\n'.format(env.host_string)
    else:
        put(apk, os.sep.join((target_dir, new_file_name)))

def _email(file_name,
           version,
           beta='True',
           platform='Android'):
    """
    TODO
    """

    url = _config('url', section='release')

    title = '{0} {1}'.format(platform, _config('name'))
    if _str2bool(beta):
        title = '{0} beta release'.format(title)
        to = _config('email_beta', section='release')
    else:
        title = '{0} release'.format(title)
        to = _config('email_official', section='release')

    msg = MIMEText('{0}/{1}/{2}'.format(url, version, file_name))
    title = '{0} {1}'.format(title, version)
    sender = _config('sender', section='release')

    msg['Subject'] = title
    msg['From'] = sender
    msg['To'] = to

    s = smtplib.SMTP(_config('smtp', section='release'))
    s.sendmail(sender, [to], msg.as_string())
    s.quit()

def _get_letter(obj):
    """ TODO """
    i = len(obj)-1
    return chr(i+ord('a'))

def _get_runtime(target='local'):
    """
    Get fieldtrip runtime directories.
    Returns a tuple containing:

    0) the project runtime root
    1) application specific runtime.
    """

    runtime_dir = _config('runtime_dir')
    target_dir = os.sep.join((os.environ['HOME'], target))
    return target_dir, os.sep.join((target_dir, runtime_dir))

def _get_source(app='android'):
    """
    Get fieldtip source directories.
    Returns a tuple containing:

    0) root                   (of source repo)
    1) project home           (of project repo)
    2) source code            (src)
    """

    root = local('pwd', capture=True).strip();
    proj_home = os.sep.join((root, 'project'))
    src_dir = os.sep.join((root, 'src'))
    return root, proj_home, src_dir

def _make_dirs(dirs):
    """ make dirs if not exist"""
    for d in dirs:
        if not os.path.exists(d):
            os.makedirs(d)

def _merge(a, b, path=None):
    """
    merges b into a

    #http://stackoverflow.com/questions/7204805/python-dictionaries-of-dictionaries-merge
    """
    if path is None: path = []
    for key in b:
        if key in a:
            if isinstance(a[key], dict) and isinstance(b[key], dict):
                _merge(a[key], b[key], path + [str(key)])
            elif a[key] == b[key]:
                pass # same leaf value
            else:
                a[key] = b[key]
        else:
            a[key] = b[key]
    return a

def _prettify(output, indent='2'):
    """ custom indentation for BeautifulSoup"""
    soup = BeautifulSoup(output, "html5lib")
    if len(soup.findAll('script')) > 0:
        s = soup.prettify()
    else:
        s = soup.div.prettify()
    r = re.compile(r'^(\s*)', re.MULTILINE)
    return r.sub(r'\1\1', s)

def _read_data(fil):
    """ TODO """
    with open(fil, 'r') as f:
        filedata = f.read()
        f.close()
        return filedata
    return None

def _sorted(dic):
    """ TODO """
    dic = collections.OrderedDict(sorted(dic.items(), key=lambda t: t[0]))
    return dic

def _str2bool(v):
    """
    Convert v into boolean.
    """
    return v.lower() in ("yes", "true", "t", "1")


def _write_data(fil, filedata):
    """ TODO """
    f = open(fil, 'w')
    f.write(filedata)
    f.close()
