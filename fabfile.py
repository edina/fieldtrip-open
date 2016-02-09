"""
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
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

from copy import copy, deepcopy
from configparser import ConfigParser, ExtendedInterpolation, NoOptionError
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fabric.api import cd, env, execute, hosts, lcd, local, put, run, settings, task
from fabric.contrib.files import exists
from fabric.contrib.project import rsync_project
from html_generator import HtmlGenerator
from jinja2 import Environment, FileSystemLoader

import xml.etree.ElementTree as ET

import ast
import codecs
import datetime
import itertools
import json
import os
import smtplib
import sys
import re


CORDOVA_VERSION = '4.3.1'
CORDOVA_ANDROID_VERSION = None # can be used to enable alternative android version

OPENLAYERS_VERSION = '2.13.1'
NPM_VERSION = '2.11.3'
BOWER_VERSION = '1.4.1'
JSHINT_VERSION = '2.8.0'
PLUGMAN_VERSION = '0.23.1'

# lowest supported android sdk version
# could move to config if projects diverge
MIN_SDK_VERSION = 14 # 4.0 Ice cream sandwich
TARGET_SDK_VERSION = 19 # 4.4 Kitkat

"""
Tools installed via npm.
The v_search value is the expected output of running the command -v
"""
npm_commands = {
    'bower':{
        'version': BOWER_VERSION,
    },
    'cordova':{
        'version': CORDOVA_VERSION,
    },
    'jshint':{
        'version': JSHINT_VERSION,
        'v_search': 'jshint v{0}'.format(JSHINT_VERSION)
    },
    'npm':{
        'version': NPM_VERSION
    },
    'plugman':{
        'version': PLUGMAN_VERSION
    }
}

config = None

@task
def check_plugins():
    """
    Check if newer versions of cordova plugin are available.

    Current version of plugman 0.23.3 not working, https://issues.apache.org/jira/browse/CB-9198
    """
    _check_command('plugman')

    json_file = os.path.join(_get_source()[1], 'theme', 'project.json')
    if os.path.exists(json_file):
        plugins = json.loads(open(json_file).read())['plugins']['cordova']
        for plugin in plugins:
            if '@' in plugin:
                name, version = plugin.split('@')
                out = local('plugman info {0}'.format(name), capture=True)
                lines = out.split('\n')
                for line in lines:
                    info = line.split(':')
                    if info[0] == 'version':
                        latest_version = info[1].strip()
                if version != latest_version:
                    print '*** {0}@{1} not using latest version {2} ***\n'.format(name, version, latest_version)
                else:
                    print '{0} up to date'.format(name)
    else:
        print 'Where is the plugins file?: {0}'.format(json_file)
        exit(-1)

@task
def clean_runtime(target='local'):
    """
    Remove the runtime directory

    return True if directory sucessfully deleted.
    """
    runtime = _get_runtime(target)[1]
    if os.path.exists(runtime):
        msg = 'Do you wish to delete {0} (Y/n)? > '.format(runtime)
        answer = raw_input(msg.format(runtime)).strip()
        if len(answer) == 0 or answer.lower() == 'y':
            local('rm -rf {0}'.format(runtime))
            return True
        else:
            print 'Nothing removed.'
            return False

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
                if out.find('Your branch is ahead') != -1:
                    print "\nWon't delete {0} until all commits are pushed".format(repo)
                    exit(-1)
                out = local('git status -s', capture=True)
                if len(out.splitlines()) > 0:
                    print "\nWon't delete {0} until there are no uncommitted changes".format(repo)
                    exit(-1)
                out = local('git stash list', capture=True)
                if len(out.splitlines()) > 0:
                    print "\nWon't delete {0} there are stashed changes".format(repo)
                    exit(-1)
                else:
                    local('rm -rf {0}'.format(repo))

    msg = '\n*** WARNING ***\nfab clean will delete the project and all plugin repositories. While this task attempts to check there are no uncommited or stashed changes (and will not continue if there are) it is still probably best to check manually to avoid any loss of work.\nDo you wish to continue(y/N)? > '
    answer = raw_input(msg).strip()

    if len(answer) == 0 or answer.lower() != 'y':
        print 'Choosing not continue.'
        return

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
        local('bower cache clean')

    plugins = os.sep.join((root, 'plugins'))
    if os.path.exists(plugins):
        with lcd(plugins):
            for plugin in os.listdir(plugins):
                delete_repo(os.sep.join((plugins, plugin)))
        local('rmdir plugins')


@task
def build(platform='android'):
    """
    Build the app for a specific platform
    """

    _check_commands(['cordova'])

    merge_locales()
    # generate html for android
    generate_html(platform, cordova=True)

    with lcd(_get_runtime()[1]):
        local('cordova build {0}'.format(platform))


@task
def build_android():
    _check_commands(['ant', 'android'])

    build('android')


@task
def deploy_android(uninstall='False'):
    """
    Deploy to android device connected to machine

    uninstall - use this flag to first uninstall app.
    """
    _check_commands(['adb'])

    build_android()

    if _str2bool(uninstall):
        local('adb uninstall {0}'.format(_config('package', section='app')))

    with lcd(_get_runtime()[1]):
        with settings(warn_only=True):
            cmd = 'cordova run android 2>&1'
            out = local(cmd, capture=True)
            print out
            # TODO
            # currently a bug in cordova that returns 0 when cordova run android fails
            # see https://issues.apache.org/jira/browse/CB-8460
            # just check the output instead
            #if out and out.return_code != 0:
            if out.find('INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES') != -1 or out.find('INSTALL_FAILED_UPDATE_INCOMPATIBLE') != -1:
                # app is installed with wrong certificate try and uninstall app
                local('adb uninstall {0}'.format(_config('package', section='app')))

                # retry install
                local(cmd)
            #    else:
            #        print out
            #        raise SystemExit(out.return_code)


@task
def build_ios():
    """
    Build the ios app
    """
    _check_commands(['xcode-select'])
    build('ios')


@task
def deploy_ios():
    """
    Deploy to an iOS device connected to machine
    """

    with lcd(_get_runtime()[1]):
        local('cordova run ios')


@task
def generate_config_js(version=None, fetch_config=True):
    """ generate config.js """
    root, proj_home, src_dir = _get_source()

    if _str2bool(fetch_config):
        _check_config()

    if version == None:
        versions = None
        theme_src = os.sep.join((proj_home, 'theme'))
        with open(os.path.join(theme_src, 'project.json'), 'r') as f:
            version = json.load(f)["versions"]["project"]

    # using config initialises it
    _config('name')

    # convert items list into dictionary
    values = {}
    for entry in config.items('app'):
        values[str(entry[0])] = str(entry[1])
    values['version'] = str(version)

    templates = os.sep.join((src_dir, 'templates'))
    out_file = os.sep.join((src_dir, 'www', 'js', 'config.js'))
    environ = Environment(loader=FileSystemLoader(templates))
    template = environ.get_template("config.js")
    output = template.render(config=values)
    _write_data(out_file, output)

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
        cordova = _str2bool(cordova)

    #setup paths
    root, proj_home, src_dir = _get_source()

    htmlGenerator = HtmlGenerator(platform, cordova, root, proj_home, src_dir, _config(), _config(None, "settings"))
    htmlGenerator.generate()
    #copy all the editors that exist inside the editors folder of the project
    if os.path.exists(os.path.join(proj_home, 'src', 'editors')):
        local('cp -r {0}/* {1}'.format(os.path.join(proj_home, 'src', 'editors'), os.path.join(src_dir, 'www', 'editors')))

@task
def generate_html_ios():
    generate_html(platform="ios")

@task
def install_cordova_plugin(repo, platform='android', target='local'):
    """
    Install cordova plugin from a local directory.
    """
    _check_command('cordova')

    repo = os.path.expanduser(repo)
    if not os.path.exists(repo):
        print "Can't find plugin {0}".format(repo)
        exit(-1)
    plugin_xml = os.path.join(repo, 'plugin.xml')
    if not os.path.exists(plugin_xml):
        print "Cordova plugins need a plugin.xml file: {0}".format(plugin_xml)
        exit(-1)

    runtime = _get_runtime(target)[1]

    root = ET.parse(plugin_xml).getroot()
    id = root.attrib['id']
    with lcd(runtime):
        with settings(warn_only=True):
            # remove plugin first
            local('cordova plugin rm {0}'.format(id))
        local('cordova plugin add {0}'.format(repo))

@task
def install_plugins(target='local', cordova="True"):
    """
    Set up project plugins

    target - runtime root
    cordova - flag to switch on/off fetching of cordova plugins
    """

    runtime = _get_runtime(target)[1]
    root, proj_home, src_dir = _get_source()
    asset_dir = os.sep.join((src_dir, 'www'))
    theme = os.sep.join((asset_dir, 'theme'))

    with settings(warn_only=True):
        # remove old sym links
        local('rm -r {0}/plugins/*'.format(asset_dir))

    with lcd(root):
        if not os.path.exists('plugins'):
            local('mkdir plugins')

    # process project json file
    json_file = os.sep.join((theme, 'project.json'))
    if os.path.exists(json_file):
        pobj = json.loads(open(json_file).read())['plugins']

        if _str2bool(cordova):
            with lcd(runtime):
                # do cordova plugins
                for name in pobj['cordova']:
                    local('cordova plugin add {0}'.format(name))

        # do fieldtrip plugins
        proot = os.path.join(root, 'plugins')
        for plugin, details in pobj['fieldtrip'].iteritems():
            dest = os.path.join(asset_dir, 'plugins', plugin)

            if details[0:14] == 'https://github':
                # if repository given in https:// format convert to git@
                print 'Converting {0} to '.format(details)
                details = 'git@{0}.git'.format(details[8:]).replace('/', ':', 1)

            if not details[0:3] == 'git':
                # bower plugin
                name = 'fieldtrip-{0}'.format(plugin)
                local('bower install {0}#{1}'.format(name, details))
                local('mkdir {0}'.format(dest))
                src = os.path.join(root, 'bower_components', name, 'src', 'www')
                local('cp -r {0}/* {1}'.format(src, dest))
            else:
                # git repository
                plugin_src = os.path.join(proot, plugin)
                if not os.path.isdir(plugin_src):
                    with lcd(proot):
                        if '#' in details:
                            # a branch is defined clone as single branch
                            repo = details.split('#')
                            local('git clone -b {0} --single-branch {1} {2}'.format(
                                repo[1], repo[0], plugin))
                        else:
                            # clone whole repo
                            local('git clone {0} {1}'.format(details, plugin))
                        with lcd(plugin):
                            local('ln -s {0} {1}'.format(
                                os.path.join(root, 'scripts', 'pre-commit.sh'),
                                os.path.join('.git', 'hooks', 'pre-commit')))

                www = os.path.join(plugin_src, 'src', 'www')
                if os.path.exists(www):
                    # create sym link to repos www dir
                    local('ln -s {0} {1}'.format(www, dest))

                    with lcd(plugin_src):
                        # install any bower dependencies in plugin
                        local('bower install')
                        bower_comps = os.path.join(plugin_src, 'bower_components')
                        if os.path.exists(bower_comps):
                            js_ext = os.path.join(www, 'js', 'ext', '')
                            if not os.path.exists(js_ext):
                                local('mkdir -p {0}'.format(js_ext))
                            js_dirs = ['js', 'src', 'dist']
                            for dep in os.listdir(bower_comps):
                                for js_dir in js_dirs:
                                    ext_src = os.path.join(bower_comps,
                                                           dep, js_dir, '')
                                    if os.path.exists(ext_src):
                                        local('cp {0}* {1}'.format(
                                            ext_src,
                                            js_ext))
                else:
                    print 'Plugin has no www dir: {0}'.format(www)
                    exit(-1)
    else:
        print 'Where is the plugins file?: {0}'.format(json_file)
        exit(-1)

@task
def install_project(platform='android',
                    dist_dir='apps',
                    target='local',
                    project_branch='master',
                    config_url=None,
                    config_port=None):
    """
    Install Cordova runtime

    platform - android or ios (android by default)
    dist_dir - directory for unpacking openlayers
    target - runtime root
    project_branch - project branch name
    config_url - location of the config.ini
    config_port - port at which the config.ini will be fetched by ssh
    """
    if platform == 'android':
        _check_commands(['android', 'ant'])
    _check_commands(['cordova', 'npm', 'bower', 'jshint', 'wget'])

    root, proj_home, src_dir = _get_source()

    # get config file
    _check_config(config_url, config_port)

    target_dir, runtime = _get_runtime(target)
    js_ext_dir = os.sep.join(('www', 'js', 'ext'))
    css_ext_dir = os.sep.join(('www', 'css', 'ext'))

    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    # create project repo
    if not os.path.exists('project'):
        proj = _config('project')
        pro_name = proj[proj.rfind('/') + 1:].replace('.git', '')
        local('git clone {0}'.format(proj))
        local('ln -s {0} {1}'.format(pro_name, 'project'))
    if project_branch != 'master':
        with lcd('project'):
            print 'Try checking out project branch {0}'.format(project_branch)
            local('git checkout {0}'.format(project_branch))
    if not os.path.exists('.git/hooks/pre-commit'):
        local('ln -s {0} {1}'.format(
            os.path.join(root, 'scripts', 'pre-commit.sh'),
            os.path.join('.git', 'hooks', 'pre-commit')))

    # do some checks on the project
    theme_src = os.sep.join((proj_home, 'theme'))
    if not os.path.exists(os.sep.join((theme_src, 'project.json'))):
        print "\n*** ERROR: No project.json found in project"
        exit(-1)
    theme_css = os.sep.join((theme_src, 'css'))
    if not os.path.exists(os.sep.join((theme_css, 'jqm-style.css'))):
        print "\n*** WARNING: No jqm-style.css found in project: {0}".format(theme_css)
    if not os.path.exists(os.sep.join((theme_css, 'style.css'))):
        print "\n*** WARNING: No style.css found in project"

    versions = None
    with open(os.path.join(theme_src, 'project.json'), 'r') as f:
        versions = json.load(f)["versions"]

    # check using correct core git version
    if not _is_in_branch(root, versions['core']):
        print '\nUsing wrong FT Open branch/tag. Should be using {0}.'.format(
            versions['core'])
        exit(-1)

    # create cordova config.xml
    _generate_config_xml()

    # install external js libraries
    local('bower install')
    bower = json.loads(open('bower.json').read())
    bower_home = os.sep.join((root, 'bower_components'))

    # install cordova
    install_cordova = True
    if os.path.exists(runtime):
        with lcd(runtime):
            with settings(warn_only=True):
                out = local('cordova platform list 2>&1', capture=True)
                installed_version = local('cordova --version 2>&1', capture=True)

            if "not a Cordova-based project" in out or installed_version != CORDOVA_VERSION:
                # If the directory exists but it's not a cordova project or the
                # cordova version is different from expected, remove runtime
                if not clean_runtime(target):
                    print 'Looks like a problem cleaning runtime'
                    exit(-1)
            else:
                install_cordova = False

    if install_cordova:
        local('cordova create "{0}" "{1}" "{2}"'.format(
            runtime,
            _config('package', section='app'),
            _config('name')))

    # Install platform
    with lcd(runtime):
        platform_path = os.sep.join((runtime, 'platforms', platform))

        if(os.path.exists(platform_path)):
            if config_url:
                local('cordova platform rm {0}'.format(platform))
            else:
                msg = 'Platform {0} exists\nDo you wish to delete it(Y/n)? > '
                answer = raw_input(msg.format(platform)).strip()
                if len(answer) == 0 or answer.lower() == 'y':
                    local('cordova platform rm {0}'.format(platform))
                else:
                    print 'Choosing not continue. Nothing installed.'
                    exit(-1)

        # create sym link to assets
        local('rm -rf www')
        asset_dir = os.sep.join((src_dir, 'www'))
        local('ln -s {0}'.format(asset_dir))

        # Replace default config.xml and symlink to our version
        local('rm config.xml')
        local('ln -s %s' % os.sep.join(('www', 'config.xml')))

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
            local('rm {0}/*.css'.format(css_ext_dir))
            local('rm {0}/plugins/*'.format(asset_dir))

        # set up bower dependecies
        for dep in bower['dependency_locations']:
            files = bower['dependency_locations'][dep]
            version = bower['dependencies'][dep]
            for f in files:
                if version[:4] == 'http':
                    # if a url has been given get the version from it
                    version = re.search('((\d\.){2}\d)', version).group(0)
                f = f.replace('x.x', version)
                src = os.sep.join((bower_home, dep, f))
                f_name = dep.replace('-bower', '')

                if (f_name == 'leaflet' or f_name == 'leaflet.marketcluster' or f_name == 'proj4leaflet') and  _config('maplib', section='app') != 'leaflet':
                    # only install leaflet if required
                    continue

                if f[len(f) - 2:] == 'js':
                    dest = os.sep.join((js_ext_dir, '{0}.js'.format(f_name)))
                else:
                    dest = os.sep.join((css_ext_dir, '{0}.css'.format(f_name)))
                local('cp {0} {1}'.format(src, dest))

        # install the platform
        if CORDOVA_ANDROID_VERSION and platform is 'android':
            local('cordova platform add {0}@{1}'.format(platform, CORDOVA_ANDROID_VERSION))
        else:
            local('cordova platform add {0}'.format(platform))

    # generate config js
    generate_config_js(version=versions['project'],
                       fetch_config=False)

    # set up cordova/fieldtrip plugins
    install_plugins(target)

    # add project specific files
    update_app(platform)

    # process tempates
    generate_html(platform='desktop')

    merge_locales()

    # check if /home/<user>/<dist_dir> exists
    dist_path = os.sep.join((os.environ['HOME'], dist_dir))
    if not os.path.exists(dist_path):
        os.makedirs(dist_path)

    if _config('maplib', section='app') != 'leaflet':
        # check if openlayers is installed
        ol_dir = 'OpenLayers-%s' % OPENLAYERS_VERSION
        ol_path = os.sep.join((dist_path, ol_dir))

        if not os.path.exists(ol_path):
            # install openlayers
            with lcd(dist_path):
                ol_tar_file_name = '%s.tar.gz' % ol_dir
                ol_tar = 'http://github.com/openlayers/openlayers/releases/download/release-{0}/{1}'.format(OPENLAYERS_VERSION, ol_tar_file_name)
                local('wget %s' % ol_tar)
                local('tar xvfz %s' % ol_tar_file_name)

        with lcd(os.sep.join((ol_path, 'build'))):
            cfg_file = os.sep.join((src_dir, 'etc', 'openlayers-mobile.cfg'))
            js_mobile = os.sep.join((runtime, js_ext_dir, 'openlayers.js'))
            local('./build.py %s %s' % (cfg_file, js_mobile))

@task
def install_project_ios(target='local'):
    """
    """
    install_project(platform='ios', target=target)

@task
def install_project_android(target='local'):
    """
    Install the android project in the cordova runtime
    """
    install_project(platform='android', target=target)


def _find_translations(path):
    """
    Scan the path for translations and creates an array with paths where the
    same combination lang/file was found in the following format:
        {
            'en': {
                'namespace.json': [path1, path2]
            },
            'es': {
                'namespace.json': [path1, path3]
            }
        }
    """
    list_locales = {}

    if os.path.exists(path):
        for root, dirs, files in os.walk(path):
            lang = os.path.relpath(root, path)

            for filename in files:
                if not filename.endswith('.json'):
                    continue

                if lang not in list_locales.keys():
                    list_locales[lang] = {}

                if filename not in list_locales[lang].keys():
                    list_locales[lang][filename] = []

                list_locales[lang][filename].append(path)

    return list_locales


def _concat_translation_paths(dict_a, dict_b={}):
    """
    Combines two of the dictionaries returned for _find_translations
    concatenating the array of paths when found
    """
    out_dict = dict.copy(dict_a)

    for lang in dict_b.keys():
        for filename in dict_b[lang].keys():
            if lang in out_dict.keys() and filename in out_dict[lang].keys():
                out_dict[lang][filename].extend(dict_b[lang][filename])
            else:
                out_dict[lang][filename] = dict_b[lang][filename]

    return out_dict


@task
def merge_locales():
    """
    Merge the translations from the core, plugins and project in that order
    into a cleared www/locales directory
    """

    root, project, src = _get_source()

    out_dir = os.path.join(src, 'www', 'locales')
    core_locales_dir = os.path.join(src, 'locales')
    project_locales_dir = os.path.join(project, 'src', 'locales')
    plugins_dir = os.path.join(root, plugins)

    # clear the locales output directory
    with settings(warn_only=True):
        local('rm -r {0}/*'.format(out_dir))

    # find the translations in for core, plugins and project
    core_files = _find_translations(core_locales_dir)
    project_files = _find_translations(project_locales_dir)
    plugin_files = []

    for plugin in os.listdir(plugins_dir):
        plugin_dir = os.path.join(plugins_dir, plugin)
        if os.path.isdir(plugin_dir):
            plugin_locales_dir = os.path.join(plugin_dir, 'src', 'locales')
            plugin_files.append(_find_translations(plugin_locales_dir))

    # merge the list of paths
    locales_paths = _concat_translation_paths(core_files)
    for plugin_locales in plugin_files:
        locales_paths = _concat_translation_paths(locales_paths,
                                                  plugin_locales)

    locales_paths = _concat_translation_paths(locales_paths, project_files)

    # merge and write the translations
    for lang in locales_paths.iterkeys():
        for file, paths in locales_paths[lang].iteritems():
            out = {}
            for path in paths:
                with open(os.path.join(path, lang, file), 'r') as f:
                    out.update(json.loads(f.read()))
            lang_path = os.path.join(out_dir, lang)
            if not os.path.exists(lang_path):
                os.mkdir(lang_path)

            with codecs.open(os.path.join(lang_path, file), 'w', 'utf8') as f:
                f.write(json.dumps(out, ensure_ascii=False, indent=2))


@task
def release_android(
        beta='True',
        overwrite='False',
        email=False,
        fetch_config='True'):
    """
    Release android version of fieldtrip app

    beta - BETA release or LIVE?
    overwrite - should current apk file be overwitten?
    email - send email to ftgb mailing list?
    fetch_config - should remote config be fetched?
    """

    _check_commands(['cordova', 'ant', 'zipalign'])

    root, proj_home, src_dir = _get_source()
    if _str2bool(fetch_config):
        _check_config()
    runtime = _get_runtime()[1]

    # generate html for android
    generate_html(cordova=True)

    update_app('android')

    # Read the project name from the ant build file
    tree = ET.parse(os.sep.join((runtime, 'platforms', 'android', 'build.xml')))
    root = tree.getroot()
    if 'name' in root.attrib.keys():
        file_prefix = root.attrib['name']
    else:
        file_prefix = _config('name').replace(' ', '')

    # get app version
    theme_src = os.sep.join((proj_home, 'theme'))
    with open(os.path.join(theme_src, 'project.json'), 'r') as f:
        pjson = json.load(f)
        versions = pjson["versions"]
        plugins = pjson["plugins"]

    with lcd(runtime):
        android_runtime = os.path.join(runtime, 'platforms', 'android')

        # do the build
        if _str2bool(beta):
            file_name = '{0}-debug.apk'.format(file_prefix)
            apkfile = os.path.join(android_runtime, 'ant-build', file_name)
            local('cordova build android')
        else:
            # check plugin and project versions
            if versions['core'] == 'master':
                print "\nCan't release with untagged core repository: {0}".format(
                    versions['core'])
                exit(1)
            if not _is_in_branch(proj_home, versions['project']):
                print "To release the project must be tagged and checked out with release version. project: {0}".format(versions['project'])
                exit(1)
            for cplug in plugins['cordova']:
                if len(cplug.split('@')) != 2 and len(cplug.split('#')) != 2:
                    print "Must release with a versioned cordova plugin: {0}".format(cplug)
                    exit(1)
            for name, version in plugins['fieldtrip'].items():
                if version[-3:] == 'git':
                    print "Must release with versioned fieldtrip plugin: {0}".format(name)
                    exit(1)

            file_name = '{0}.apk'.format(file_prefix)
            bin_dir = os.path.join(android_runtime, 'bin')
            apkfile = os.path.join(bin_dir, file_name)
            with lcd(android_runtime):
                sdk_dir = local('which android', capture=True).split('tools')[0]
                local('ant clean release -Dsdk.dir={0}'.format(sdk_dir))

            # sign the application
            unsigned_apkfile = os.path.join(bin_dir, '{0}-release-unsigned.apk'.format(file_prefix))
            signed_apkfile = os.path.join(bin_dir, '{0}-release-signed.apk'.format(file_prefix))
            local('cp {0} {1}'.format(unsigned_apkfile, signed_apkfile))
            keystore_name = _config('keystore_name', section='release')
            keystore = os.path.join(_config('keystore_location', section='release'),
                                    '{0}.keystore'.format(keystore_name))

            if keystore.find('@') != -1:
                # if keystore is stored remotely copy it locally
                ks_name = keystore[keystore.rfind('/') + 1: len(keystore)]
                keystore_local = os.sep.join((src_dir, 'etc', ks_name))
                local('scp {0} {1}'.format(keystore, keystore_local))
                keystore = keystore_local

            local('jarsigner -verbose -sigalg MD5withRSA -digestalg SHA1 -keystore {0} {1} {2}'.format(
                keystore,
                signed_apkfile,
                keystore_name))

            # align the apk file
            local('zipalign -v 4 {0} {1}'.format(signed_apkfile, apkfile))

    # copy apk to servers, if defined
    env.hosts = _config('hosts', section='release').split(',')
    version = versions['project']
    if len(env.hosts) > 0:
        execute('_copy_apk_to_servers',
                version,
                apkfile,
                file_name,
                _str2bool(overwrite))

    # inform of release
    if email:
        _email(file_name, version, beta)


@task
def release_ios():
    """
    Release ios version of fieldtrip app
    """

    # TODO
    print 'Waiting for someone to do this.'

@task
def stats_usage(year='2015'):
    """
    Print out android app start stats by version.

    year - collate stats in this year
    """
    totals = {}

    versions = ['2.3', '4.0', '4.1', '4.2', '4.3', '4.4', '5.0']
    for version in versions:
        #fetch_month(version)
        pattern = 'splash.+Android {0}'.format(version)
        totals[version] = _stats_monthly(year, pattern)
    for version, months in totals.iteritems():
        print version,':'
        print 'Month'.ljust(10), 'Unique'.ljust(10), 'Total'.ljust(10)
        for i, month in months.iteritems():
            tcount = 0
            for ip, vals in month.iteritems():
                tcount = tcount + vals['count']
            print datetime.date(2014, i, 1).strftime('%B').ljust(10), str(len(month)).ljust(10), str(tcount).ljust(10)
        print '\n'

@task
def stats_export(year='2015'):
    """
    Print authoring tool export stats.

    year - collate stats in this year
    """
    totals = {}
    types = ['geojson', 'kml', 'csv']
    for type in types:
        pattern = 'records/dropbox/.+filter=format&frmt={0}'.format(type)
        totals[type] = _stats_monthly(year, pattern)

    for type, months in totals.iteritems():
        print type,':'
        print 'Month'.ljust(10), 'Unique'.ljust(10), 'Total'.ljust(10)
        for i, month in months.iteritems():
            tcount = 0
            for ip, vals in month.iteritems():
                tcount = tcount + vals['count']
            print datetime.date(2014, i, 1).strftime('%B').ljust(10), str(len(month)).ljust(10), str(tcount).ljust(10)
        print '\n'

@task
def stats_uploaded_records(year='2015'):
    """
    Based in the access logs reports the records posted per month
    """
    pattern = 'POST.*?\/pcapi\/records\/dropbox\/.*?\/([^\.]+) HTTP'
    months = _stats_monthly(year, pattern)
    for month, ips in months.iteritems():
        tcount = 0
        for ip, vals in ips.iteritems():
            tcount = tcount + vals['count']
        print datetime.date(int(year), month, 1).strftime('%B').ljust(10), str(tcount).ljust(10)

@task
def update_app(platform='android'):
    """
    Update the platform with latest configuration (android by default)
    """

    proj_home = _get_source()[1]
    runtime = _get_runtime()[1]

    src = os.path.join(proj_home, 'platforms', platform, '')
    dst = os.path.join(runtime, 'platforms', platform, '')

    if os.path.exists(src):
        if os.path.exists(dst):
            local('cp -rf {0}* {1}'.format(src, dst))
        else:
            print "\nPlatform {0} not installed".format(platform)
            exit(-1)

    if platform == 'android':
        # current version of cordova does not allow access to all settings,
        # see https://cordova.apache.org/docs/en/3.5.0/guide_platforms_android_config.md.html#Android%20Configuration
        _update_android_manifest(os.path.join(runtime, 'platforms', platform))


def _check_command(cmd):
    """
    Checks a command is in the path. If the command is an npm command and not
    available it will be installed. npm commands are also checked that the
    correct version is installed.
    """
    with settings(warn_only=True):
        out = local('command -v {0}'.format(cmd), capture=True)
        if out.return_code != 0:
            if cmd in npm_commands:
                _install_npm_command(cmd)
            else:
                print '{0} needs to be installed and in your path'.format(cmd)
                exit(0)

    if cmd in npm_commands:
        current_version = local('{0} -v 2>&1'.format(cmd), capture=True)
        if 'v_search' in npm_commands[cmd]:
            version = npm_commands[cmd]['v_search']
        else:
            version = npm_commands[cmd]['version']
        if current_version != version:
            _install_npm_command(cmd)

def _check_commands(cmds):
    """
    Checks all commands are in the path. If the command is an npm command and not
    available it will be installed. npm commands are also checked that the
    correct version is installed.
    """
    for command in cmds:
        _check_command(command)

def _check_config(location=None, port=None):
    """
    If config.ini exists update from remote location, otherwise prompt user for location
    location - location of the config.ini
    port - port of the host of where the config.ini is
    """
    global config

    root = _get_source()[0]
    conf_dir = os.sep.join((root, 'etc'))
    conf_file = os.sep.join((conf_dir, 'config.ini'))
    if not location:
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
                    port = _config('location_port')
                    if port:
                        local('scp -P {0} {1} {2}'.format(port, answer, conf_dir))
                    else:
                        local('scp {0} {1}'.format(answer, conf_dir))

        # pick up any changes from remote config
        location = _config('location')
    print location
    if location[0: 4] == 'git@':
        # config is in secure git repo
        with lcd(conf_dir):
            # work out how deep config file is in directory structure to flatten it
            parts = location.split(' ')
            strip_comp = len(parts[len(parts) - 1].split('/')) - 1

            # fetch file from git repo
            local('git archive --remote={0} | tar -x --strip-components {1}'.format(
                location, strip_comp))
    elif location.find('@') != -1:
        if not port:
            port = _config('location_port')
        if port:
            local("rsync -avz -e 'ssh -p {0}' {1} {2}".format(
                port, location, conf_file))
        else:
            local('rsync -avz {0} {1}'.format(location, conf_file))
    config = None # make sure it is re-read

def _config(key=None, section='install'):
    """
    Get config value for key.

    key - config key
    section - config section, e.g install, release or app
    """

    global config
    if config == None:
        config = ConfigParser(interpolation=ExtendedInterpolation())
        conf_file = os.path.join(_get_source()[0], 'etc', 'config.ini')
        config.read(conf_file)

    if config.has_section(section):
        if key == None:
            return dict(config.items(section))
        else:
            val = None
            try:
                val = config.get(section, key)
            except NoOptionError:
                pass
            return val
    else:
        return None

@task
def _copy_apk_to_servers(version, apk, new_file_name, overwrite):
    """
    Copy APK file to servers

    version - app version
    apk - apk file, as generated from build
    new_file_name - the new, user friendly, name for the apk file
    overwrite - should current apk file be overwitten?
    """

    runtime = _get_runtime()[1];

    # copy to server
    target_dir = '{0}/{1}'.format(_config('dir', section='release'), version)
    if not exists(target_dir):
        run('mkdir -p {0}'.format(target_dir))

    target_file = os.sep.join((target_dir, new_file_name))
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
    Email release details to team.

    file_name - apk file name
    version - app version
    beta - is this a beta or official release
    platform - android or ios
    """

    _check_command('qrencode')

    url = '{0}/{1}/{2}'.format(
        _config('url', section='release'),
        version,
        file_name)

    title = '{0} {1}'.format(platform, _config('name'))
    if _str2bool(beta):
        title = '{0} beta release'.format(title)
        to = _config('email_beta', section='release')
    else:
        title = '{0} release'.format(title)
        to = _config('email_official', section='release')

    html = '<html><head></head><body><a href="{0}">{0}</a></p></body></html>'.format(url)
    title = '{0} {1}'.format(title, version)
    sender = _config('sender', section='release')

    msg = MIMEMultipart()
    msg['Subject'] = title
    msg['From'] = sender
    msg['To'] = to
    msg.attach(MIMEText(html, 'html'))

    attachment = 'qrcode.png'
    local('qrencode -o {0} {1}'.format(attachment, url))
    fp = open(attachment, 'rb')
    img = MIMEImage(fp.read())
    fp.close()
    img.add_header('Content-ID', '<image1>')
    msg.attach(img)

    s = smtplib.SMTP(_config('smtp', section='release'))
    s.sendmail(sender, [to], msg.as_string())
    s.quit()

def _generate_config_xml():
    """ generate config.xml """

    root, proj_home, src_dir = _get_source()
    theme_src = os.sep.join((proj_home, 'theme'))
    with open(os.path.join(theme_src, 'project.json'), 'r') as f:
        versions = json.load(f)["versions"]

    environ = Environment(loader=FileSystemLoader('etc'))
    config_template = environ.get_template("config.xml")
    version = versions['project']

    access_urls = _config('access_urls')
    if access_urls:
        access_urls = access_urls.split(",")
    else:
        access_urls = []

    filedata = config_template.render(
        name=_config('name'),
        package=_config('package', section='app'),
        version=version,
        version_code=version.replace(".", ""),
        author_email=_config('author_email'),
        url=_config('url'),
        access_urls=access_urls)
    _write_data(os.sep.join((src_dir, 'www', 'config.xml')), filedata)

def _get_branch_name(dir):
    # get the name of the git repo branch at dir
    with lcd(dir):
        out = local('git branch', capture=True)
        current = re.findall(r"^\* .+", out, re.MULTILINE)
        return current[0][2:]

def _get_runtime(target='local'):
    """
    Get fieldtrip runtime directories.
    Returns a tuple containing:

    0) the project runtime root
    1) application specific runtime.
    """

    runtime_dir = _config('runtime_dir')
    if runtime_dir == None:
        print "No runtime found: 'runtime_dir' needs to be defined."
        exit(-1)
    target_dir = os.path.join(os.environ['HOME'], target)
    return target_dir, os.path.join(target_dir, runtime_dir)

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

def _install_npm_command(cmd):
    """
    Install npm command, if this fails to install locally, it will retry using
    sudo.
    """
    with settings(warn_only=True):
        version = npm_commands[cmd]['version']
        out = local('npm install {0}@{1}'.format(cmd, version), capture=True)
        if out.return_code != 0:
            print 'Problem installing {0}@{1}'.format(cmd, version)
            exit(1)

def _is_in_branch(repo, branch):
    # checks if a git repository is in a specific branch
    is_in_branch = False
    with lcd(repo):
        name = _get_branch_name(repo)
        print name
        if name == branch:
            is_in_branch = True
        elif '(detached from {0})'.format(branch) == name or '(HEAD detached at {0})'.format(branch) == name:
            is_in_branch = True

    if not is_in_branch:
        print 'branch {0} does not match {1}'.format(name, branch)

    return is_in_branch

def _make_dir(path):
    # make path if it doesn't exist
    if not os.path.exists(path):
        os.makedirs(path)

def _make_dirs(dirs):
    # make directories if they don't exist
    for d in dirs:
        _make_dir(d)

def _path_join(*dirs):
    # create path and make sure directory exists
    path = os.path.join(*dirs)
    _make_dir(path)
    return path

def _read_data(fil):
    """ TODO """
    with open(fil, 'r') as f:
        filedata = f.read()
        f.close()
        return filedata
    return None

def _stats_monthly(year, pattern):
    # calcluate monthly stats based on a grep pattern
    months = {}

    for i in range(1, 13):
        month = {}

        logname = "access_log.{0}-{1}*".format(year, str(i).zfill(2))
        cmd = "find /var/log/httpd/ -name \"{0}\" | xargs grep -P \"{1}\" | awk '{{print $1}}'".format(
            logname, pattern)

        # get stats from prime
        host = _config('prime_host', section='common')
        env.hosts = [host]
        out = execute('_stats_run_command', cmd)
        lines = out[host]

        # get stats from backup
        host = _config('backup_host', section='common')
        env.hosts = [host]
        out = execute('_stats_run_command', cmd)
        lines = lines + out[host]

        for l in lines:
            if len(l) == 0:
                continue
            ip = l.split(':')[1].replace('\r', '')

            # ignore edina ip adresses
            if ip[:11] == '129.215.169':
                continue

            if ip in month:
                month[ip]['count'] = month[ip]['count'] + 1
            else:
                month[ip] = {
                    'number': len(lines),
                    'count': 1
                }
        months[i] = month
    return months

@task
def _stats_run_command(cmd):
    # run stats command and return results in a list
    out = run(cmd)
    return out.split('\n')

def _str2bool(val):
    """Convert a string representation of truth to true (1) or false (0).

    True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
    are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
    'val' is anything else.
    """
    if isinstance(val, basestring):
        val = val.lower()
        if val in ('y', 'yes', 't', 'true', 'on', '1'):
            return 1
        elif val in ('n', 'no', 'f', 'false', 'off', '0'):
            return 0
        else:
            raise ValueError("invalid truth value %r" % (val,))
    return  val

def _update_android_manifest(path):
    """
    Update android manifest
    """

    # using lxml to get namespace support
    from lxml import etree

    manifest = os.path.join(path, 'AndroidManifest.xml')

    ANS = 'http://schemas.android.com/apk/res/android'
    NS = {
        'android': ANS
    }
    root = etree.parse(manifest)

    def has_permission(name):
        exp = "uses-permission[@android:name='android.permission.{0}']".format(name)
        return len(root.xpath(exp, namespaces=NS)) > 0

    def add_permission(name):
        attr = '{{{0}}}permission'.format(ANS)
        val = 'android.permission.{0}'.format(name)
        up = etree.Element('uses-permission', attrib={attr: val})
        root.xpath('/manifest')[0].append(up)

    # ensure the following permissions are set
    permissions = ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']
    for permission in permissions:
        if not has_permission(permission):
            add_permission(permission)

    # update min sdk verison
    us = root.xpath('/manifest/uses-sdk[@android:minSdkVersion]', namespaces=NS)[0]
    us.set('{{{0}}}minSdkVersion'.format(ANS), str(MIN_SDK_VERSION))

    # update target sdk verison
    us = root.xpath('/manifest/uses-sdk[@android:targetSdkVersion]', namespaces=NS)[0]
    us.set('{{{0}}}targetSdkVersion'.format(ANS), str(TARGET_SDK_VERSION))

    with open(manifest, 'w') as f:
        f.write(etree.tostring(root, pretty_print=True))

def _write_data(fil, filedata):
    """
    fil --> filename
    filedata --> content that will be written in filename
    """
    f = open(fil, 'w')
    f.write(filedata.encode('utf-8'))
    f.close()

# import any project/plugin tasks
root, proj_dir, src_dir  = _get_source()
ptasks = [proj_dir]
plugins = os.path.join(root, 'plugins')
if os.path.exists(plugins):
    for plugin in os.listdir(plugins):
        ptasks.append(os.path.join(root, 'plugins', plugin))
for ptask in ptasks:
    if os.path.exists(os.path.join(ptask, 'fabtasks.py')):
        sys.path.append(ptask)
        import fabtasks

# add node_modules/.bin to path
if not os.path.exists('node_modules'):
    local('mkdir node_modules')
os.environ['PATH'] = '{0}:{1}'.format(
    os.path.join(root, 'node_modules/.bin'),
    os.environ['PATH'])
