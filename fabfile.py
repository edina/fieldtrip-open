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


CORDOVA_VERSION   = '3.3.1-0.1.2'
OPENLAYERS_VERSION = '2.12'
PROJ4JS_VERSION    = '1.1.0'

config = None

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
    _check_command('cordova')

    root, proj_home, src_dir = _get_source()

    # get config file
    _check_config()

    target_dir, runtime = _get_runtime(target)
    js_dir = os.sep.join(('www', 'js', 'ext'))
    css_dir = os.sep.join(('www', 'css', 'ext'))

    def _install_plugins(names):
        for name in names:
            local('cordova plugin add https://git-wip-us.apache.org/repos/asf/{0}'.format(name))

    def _settings_options(filedata, _urls, _names, place):
        urls = _config(_urls).split(",")
        names = _config(_names).split(",")
        options = []
        for name, url in itertools.izip(names, urls):
            options.append('<option value="{0}">{1}</option>'.format(url, name))
        return filedata.replace(place, "\n\t\t".join(options))

    #create config.xml
    filedata = _read_data(os.sep.join(('etc', 'config.xml')))
    filedata = filedata.replace('{{name}}', _config('name'))
    filedata = filedata.replace('{{version}}', _config('version'))
    filedata = filedata.replace('{{version_code}}', _config('version').replace(".", ""))
    filedata = filedata.replace('{{author_email}}', _config('author_email'))
    filedata = filedata.replace('{{url}}', _config('url'))
    access_urls = _config('access_urls').split(",")
    access = []
    for url in access_urls:
        access.append('<access origin="{0}" />'.format(url))
    filedata = filedata.replace('{{access_urls}}', "\n".join(access))

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

    if not os.path.exists('plugins'):
        local('mkdir plugins')
        with lcd('plugins'):
            local('git clone git@github.com:edina/fieldtrip-plugins.git')
        # TODO
        # fetch git plugins not in fieldtrip-plugins


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

        # add platform and plugins
        local('cordova platform add {0}'.format(platform))

        _install_plugins([
            'cordova-plugin-device.git',
        #    'cordova-plugin-network-information',
        #    'cordova-plugin-geolocation.git',
        #    'cordova-plugin-camera.git',
        #    'cordova-plugin-media-capture.git',
        #    'cordova-plugin-media.git',
        #    'cordova-plugin-file.git',
        #    'cordova-plugin-file-transfer.git',
        #    'cordova-plugin-inappbrowser.git',
            'cordova-plugin-console.git'])

        # create sym link to assets
        local('rm -rf www')
        asset_dir =  os.sep.join((src_dir, 'www'))
        local('ln -s {0}'.format(asset_dir))

        # link to project theme
        theme = os.sep.join((asset_dir, 'theme'))
        if not os.path.exists(theme):
            with lcd(asset_dir):
                theme_src = os.sep.join((proj_home, 'theme'))
                local('ln -s {0} theme'.format(theme_src))

        # install js/css dependencies
        _make_dirs([os.sep.join((src_dir, js_dir)), os.sep.join((src_dir, css_dir))])
        with settings(warn_only=True):
            local('rm {0}/*'.format(js_dir))
            local('rm -r {0}/*'.format(css_dir))
            local('rm {0}/plugins/*'.format(asset_dir))

        # set up fieldtrip plugins
        if os.path.exists(os.sep.join((theme, 'plugins.json'))):
            pobj = json.loads(open(os.sep.join((theme, 'plugins.json'))).read())
            proot = os.sep.join((root, 'plugins'))
            for plugin, details in pobj['plugins'].iteritems():
                if len(details) == 0:
                    # plugin is from field trip
                    src = os.sep.join((proot, 'fieldtrip-plugins', plugin))
                elif plugin[:3] == 'lib':
                    # TODO bower plugin
                    pass
                else:
                    # git repository
                    src = os.sep.join((proot, plugin))
                    if not os.path.isdir(src):
                        with lcd(proot):
                            local('git clone {0} {1}'.format(details, plugin))

                if os.path.isdir(src):
                    dest = os.sep.join((asset_dir, 'plugins', plugin))
                    local('ln -s {0} {1}'.format(src, dest))
                else:
                    print 'No such plugin: {0}'.format(src)
                    exit(-1)

        # set up bower dependecies
        for dep in bower['dependency_locations']:
            files = bower['dependency_locations'][dep]
            version = bower['dependencies'][dep]
            for f in files:
                f = f.replace('x.x', version)
                src = os.sep.join((bower_home, dep, f))
                f_name = dep.replace('-bower', '')
                if f[len(f) - 2:] == 'js':
                    dest = os.sep.join((js_dir, '{0}.js'.format(f_name)))
                else:
                    dest = os.sep.join((css_dir, '{0}.css'.format(f_name)))
                local('cp {0} {1}'.format(src, dest))

    # add project specific files
    update_app()
    _create_structure()

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
                                  os.sep.join((js_dir, 'proj4js.js'))))

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
        js_mobile = os.sep.join((runtime, js_dir, 'openlayers.js'))
        local('./build.py %s %s' % (cfg_file, js_mobile))

@task
def deploy_android():
    """
    Deploy android to device connected to machine
    """

    _check_command('ant')
    _check_command('adb')
    _check_command('cordova')
    _check_command('android')

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
def release_android(beta='True', overwrite='False', email=False):
    """
    Release version of field trip app

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
        if str2bool(beta):
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
        execute('copy_apk_to_servers', version, file_name, new_file_name, str2bool(overwrite))

    # inform of release
    if email:
        _email(new_file_name, version, beta)

@task
def generate_docs():
    """
    Auto generate javascript markdown documentation
    """

    local('jsdox --output docs/ src/www/js/')

@task
def update_app():
    """Update app with latest configuration"""
    proj_home = _get_source()[1]
    runtime = _get_runtime()[1]
    local('cp -rf {0} {1}'.format(os.sep.join((proj_home, 'platforms')),
                                  runtime))

    # miscellaneous dependencies not required for development
    local('cp -rf {0}/* {1}'.format(os.sep.join((proj_home, 'deps')),
                                    os.sep.join((runtime, 'www'))))


@task
def copy_apk_to_servers(version, file_name, new_file_name, overwrite):
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
    else:
        # pick up any changes from remote config
        location = _config('location')
        if location.find('@') != -1:
            local('rsync -avz {0} {1}'.format(location, conf_dir))


def _config(var, section='install'):
    global config
    if config == None:
        config = ConfigParser.ConfigParser()
        conf_file = os.sep.join((_get_source()[0], 'etc', 'config.ini'))
        config.read(conf_file)

    return config.get(section, var)


def _email(file_name,
           version,
           beta='True',
           platform='Android'):

    url = _config('url', section='release')

    title = '{0} {1}'.format(platform, _config('name'))
    if str2bool(beta):
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


def str2bool(v):
    return v.lower() in ("yes", "true", "t", "1")

def _create_structure():
    """ create structure of templates and data of core app and plugins"""
    structure = {}
    root, proj_home, src_dir = _get_source()

    structure["default-templates"] = _get_structure(os.sep.join((src_dir, 'www', 'templates')))
    structure["custom-templates"] = _get_structure(os.sep.join((src_dir, 'www', 'theme', 'templates')))
    #structure["plugins"] =  _get_structure(os.sep.join((root, 'plugins')))
    data = []
    data.append("define(function(){")
    data.append("    return {0}".format(json.dumps(structure)))
    data.append("});")
    _write_data(os.sep.join((src_dir, 'www', 'js', 'filesmap.js')), "\n".join(data))

def _get_structure(path):
    new_list = []
    ignored = [".gitignore", ".git", "README.md"]
    for path, dirs, files in os.walk(path):
        print path
        print dirs
        for f in files:
             if not f in ignored:
                new_list.append(f)
    return new_list

def _read_data(fil):
    with open(fil, 'r') as f:
        filedata = f.read()
        f.close()
        return filedata
    return None

def _write_data(fil, filedata):
    f = open(fil, 'w')
    f.write(filedata)
    f.close()


#########################HTML GENERATION###################################
@task
def generate_templates(platform="android", cordova=False):
    """generate files"""
    if isinstance(cordova, basestring):
        cordova = str2bool(cordova)
    root, proj_home, src_dir = _get_source()
    path = os.sep.join((src_dir, 'templates'))
    export_path = os.sep.join((src_dir, 'www'))
    environ = Environment(loader=FileSystemLoader(path))
    environ.globals["_get_letter"] = _get_letter
    environ.globals["_sorted"] = _sorted

    header_data = json.loads(open(os.sep.join((path, 'headerData.json'))).read())
    footer_data = json.loads(open(os.sep.join((path, 'footerData.json'))).read())
    header_template = environ.get_template("header.html")
    footer_template = environ.get_template("footer.html")

    for path, dirs, files in os.walk(path):
        for f in files:
            if f.endswith("html") and not f.startswith("header") and not f.startswith("footer"):
                fil = os.sep.join((path, f.split(".")[0]+"Data.json"))
                if os.path.exists(fil):
                    print "generating file {0}".format(f)
                    data = json.loads(open(fil).read())
                    data["header"].update(header_data)
                    data["footer"].update(footer_data)
                    template = environ.get_template(f)
                    header_data = {"cordova": cordova, "title": data["header"]["title"]}
                    popups=[]
                    for popup in data["popups"]:
                        popup_template = environ.get_template(data["popups"][popup]["template"])
                        popups.append(popup_template.render(data=data["popups"][popup]["data"]))
                        
                    output = template.render(header_data=header_data, body=_sorted(data["body"]), popups="\n".join(popups), platform=platform, header=header_template.render(data=data["header"],  platform=platform), footer=footer_template.render(data=data["footer"],  platform=platform))
                    _write_data(os.sep.join((export_path, f)), _prettify(output, 2))

def _prettify(output, indent='2'):
    """ custom indentation for BeautifulSoup"""
    soup = BeautifulSoup(output, "html5lib")
    if len(soup.findAll('script')) > 0:
        s = soup.prettify()
    else:
        s = soup.div.prettify()
    r = re.compile(r'^(\s*)', re.MULTILINE)
    return r.sub(r'\1\1', s)

def _get_letter(obj):
    """ """
    i = len(obj)-1
    return chr(i+ord('a'))

def _sorted(dic):
    """ """
    dic = collections.OrderedDict(sorted(dic.items(), key=lambda t: t[0]))
    return dic
