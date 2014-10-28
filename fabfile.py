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

from bs4 import BeautifulSoup
from copy import copy, deepcopy
from configparser import ConfigParser, ExtendedInterpolation, NoOptionError
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fabric.api import cd, env, execute, hosts, lcd, local, put, run, settings, task
from fabric.contrib.files import exists
from fabric.contrib.project import rsync_project
from jinja2 import Environment, PackageLoader, FileSystemLoader

import xml.etree.ElementTree as ET

import ast
import codecs
import collections
import datetime
import itertools
import json
import os
import smtplib
import sys
import re


CORDOVA_VERSION    = '3.6.3-0.2.13'
OPENLAYERS_VERSION = '2.13.1'
NPM_VERSION        = '2.1.2'
BOWER_VERSION      = '1.3.12'
JSHINT_VERSION     = '2.5.6'
PLUGMAN_VERSION    = '0.22.10'

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
                    print '*** {0}@{1} newer plugin {2} available ***'.format(name, version, latest_version)
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
def deploy_android(uninstall='False'):
    """
    Deploy to android device connected to machine

    uninstall - use this flag to first uninstall app.
    """

    _check_commands(['ant', 'adb', 'cordova', 'android'])

    # generate html for android
    generate_html(cordova=True)

    with lcd(_get_runtime()[1]):
        if _str2bool(uninstall):
            local('adb uninstall {0}'.format(_config('package', section='app')))

        local('cordova build android')

        with settings(warn_only=True):
            cmd = 'cordova run android 2>&1'
            out = local(cmd, capture=True)

            if out and out.return_code != 0:
                if out.find('INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES') != -1:

                    # app is installed with wrong certificate try and uninstall app
                    local('adb uninstall {0}'.format(_config('package', section='app')))

                    # retry install
                    local(cmd)
                else:
                    print out
                    raise SystemExit(out.return_code)

@task
def deploy_ios():
    """
    Deploy to ios device connected to machine
    """
    _check_command('cordova')

    # generate html for ios
    generate_html(platform="ios", cordova=True)

    with lcd(_get_runtime()[1]):
        device = None
        local('cordova run ios')

@task
def generate_config_js(version=None, fetch_config=True):
    """ generate config.js """
    root, proj_home, src_dir = _get_source()

    if fetch_config:
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
        cordova = str2bool(cordova)

    #setup paths
    root, proj_home, src_dir = _get_source()

    #the final destination of html generated files
    export_path = os.sep.join((src_dir, 'www'))

    def _get_plugins_templates():
        """ get a list of directories with templates """
        plugins_list = []
        for d in os.listdir(os.path.join(root, 'plugins')):
            d1 = os.path.join(root, 'plugins', d)
            for dire in os.listdir(d1):
                p = os.path.join(d1, dire)
                if os.path.isdir(p) and not dire.startswith("."):
                    tmpl_path = os.path.join(p, "templates")
                    if os.path.exists(tmpl_path):
                        plugins_list.append(tmpl_path)
        with open(os.path.join(src_dir, 'www', 'theme', 'project.json'),'r') as f:
            plgins = json.load(f)["plugins"]
            for k, v in plgins["fieldtrip"].iteritems():
                if v.replace('.', '').isdigit():
                    plugins_list.append(os.path.join('bower_components', 'fieldtrip-{0}'.format(k), 'src', 'templates'))
        return plugins_list

    #the jinja templates of core, the jinja project templates, the jinja templates of plugins
    templates_path = {"core": os.sep.join((src_dir, 'templates')), "project":
        os.path.join(proj_home, 'src', 'templates'),
        "plugins": _get_plugins_templates()}

    #function for merging data
    def _do_merge(filename, data, path):
        if os.path.exists(path) and filename in os.listdir(path):
            with open(os.path.join(path, filename), 'r') as f:
                new_data = json.load(f, object_pairs_hook=collections.OrderedDict)
            print "DATA: merging {0}".format(os.path.join(path, filename))
            return _merge(data, new_data)
        else:
            return data

    #get data from different two paths and merge them
    def _get_data(path1, filename, path2):
        with open(os.path.join(path1, filename),'r') as f:
            try:
                json_object = json.load(f, object_pairs_hook=collections.OrderedDict)
                return _do_merge(filename, json_object, path2)
            except ValueError, e:
                print "There was problem with the json file {0}".format(os.path.join(path1, filename))
                sys.exit()

    def _check_for_data(paths, filename):
        _in_plugins = []
        for d in paths["plugins"]:
            if os.path.exists(os.path.join(d, filename)):
                _in_plugins.append(d)
        return _in_plugins

    #get data and merge it
    def _get_check_data(paths, filename):
        data = None
        with open(os.path.join(paths["core"], filename),'r') as f:
            data = _do_merge(filename, json.load(f, object_pairs_hook=collections.OrderedDict), paths["project"])
        for d in paths["plugins"]:
            data = _do_merge(filename, data, d)
        return data

    #get header and footer data
    def _get_header_footer_data(templates_path):
        header_data = _get_data(templates_path["core"], 'header.json', templates_path["project"])
        footer_data = _get_data(templates_path["core"], 'footer.json', templates_path["project"])
        for d in templates_path["plugins"]:
            if os.path.exists(os.path.join(d, 'header.json')):
                _do_merge('header.json', header_data, d)
            if os.path.exists(os.path.join(d, 'footer.json')):
                _do_merge('footer.json', footer_data, d)
        return header_data, footer_data

    def _generate_templates(environ, templates):
        for templ in templates:
            print "TEMPLATE: generating template {0}".format(templates[templ])
            script_template = environ.get_template(templates[templ])
            _write_data(os.path.join(export_path, 'templates', templates[templ]), script_template.render())

    def _check_for_template(name):
        res = []
        for t in _get_plugins_templates():
            if name in os.listdir(t):
                res.append(t)
        return res

    def _find_template(name):
        pths = {}
        for t in _check_for_template(name):
            paths = t.split("/")
            pths[paths[len(paths)-3]]=t
        return pths

    def _get_letter(obj):
        """
        Get the letter that corresponds to column in a jqm grid view based on the
        number of elements in obj: see http://api.jquerymobile.com/1.3/grid-layout/
        """

        letter = 'a'
        if len(obj) > 1:
            i = len(obj) - 2
            letter = chr(i + ord('a'))

        return letter

    def _is_valid_file(f):
        return f.endswith("json") and not f in ["header.json", "footer.json", "settings.json"]

    def _generate_settings(current_path, paths, header_data, footer_data):
        """ generate setttings page """
        environ = Environment(loader=FileSystemLoader(current_path))
        settings=[]
        #get all the settings templates from plugins
        settings_in_plugins = _find_template('settings.html')
        if os.path.exists(os.path.join(paths["project"], 'settings.html')):
            settings_in_plugins["project"] = paths["project"]

        #get the settings values from config
        settings_config = _config(None, "settings")

        for plg in settings_in_plugins:
            settings_path = settings_in_plugins[plg]
            environ_settings = Environment(loader=FileSystemLoader(settings_path))
            tmpl = environ_settings.get_template('settings.html')
            data = {}
            if settings_config is not None:
                #this is needed for when the plugins come through bower
                if "fieldtrip-" in plg:
                    plg = plg.replace("fieldtrip-", "")
                if plg in settings_config.keys():
                    value = settings_config[plg]
                    if value.startswith('{'):
                        data = json.loads(value, object_pairs_hook=collections.OrderedDict)
                    else:
                        data = value
            settings.append(tmpl.render(settings=data))

        header_template = environ.get_template("header.html")
        footer_template = environ.get_template("footer.html")
        template  = environ.get_template('settings.html')
        output = template.render(settings="\n".join(settings),
                            config = _config(),
                            header=header_template.render(
                                data=header_data,
                                platform=platform),
                            footer=footer_template.render(
                                    data=footer_data,
                                    platform=platform))
        _write_data(os.sep.join((export_path, 'settings.html')), _prettify(output, 2))

    def _create_html(current_path, paths, header_data, footer_data):
        environ = Environment(loader=FileSystemLoader(current_path))
        environ_core = Environment(loader=FileSystemLoader(paths["core"]))
        environ_project = Environment(loader=FileSystemLoader(paths["project"]))
        environ.globals["_get_letter"] = _get_letter
        environ_project.globals["_get_letter"] = _get_letter

        header_template = environ_core.get_template("header.html")
        footer_template = environ_core.get_template("footer.html")

        for path, dirs, files in os.walk(current_path):
            for f in files:
                if _is_valid_file(f):
                    htmlfile = '{0}.html'.format(f.split(".")[0])
                    htmlfilepath = os.path.join(path, htmlfile)
                    jsonfilepath = os.path.join(path, f)

                    data = None
                    if current_path == paths["core"]:
                        #check if the same json exists in any of the plugins and merge it
                        data_in_plugins = _check_for_data(paths, f)
                        if len(data_in_plugins)>0:
                            for p in data_in_plugins:
                                if data == None:
                                    data = _get_data(current_path, f, p)
                                else:
                                    _merge(data, _get_data(current_path, f, p))

                    #merge with the data in json
                    if data:
                        _do_merge(f, data, paths["project"])
                    else:
                        data = _get_data(current_path, f, paths["project"])

                    #generate templates:
                    if "templates" in data:
                        _generate_templates(environ, data["templates"])

                    if os.path.exists(htmlfilepath):
                        print "generating file {0}".format(htmlfile)

                        if "header" in data:
                            _merge(data["header"], header_data)
                        else:
                            data["header"] = header_data

                        if "footer" in data:
                            if not _is_empty(data["footer"]):
                                footer_data2 = deepcopy(footer_data)
                                data["footer"] = _merge(footer_data2, data["footer"])
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
                                res = _check_for_template(data["popups"][popup]["template"])
                                if len(res) == 1:
                                    environ_popup = Environment(loader=FileSystemLoader(res[0]))
                                    popup_template = environ_popup.get_template(data["popups"][popup]["template"])
                                    print "POPUP: adding {0} popup from plugins in {1}".format(data["popups"][popup]["template"], htmlfile)
                                elif len(res) > 1:
                                    print "There popup template {0} exists more than once. This needs to be fixed.".format(data["popups"][popup]["template"])
                                    sys.exit()
                                else:
                                    popup_template = environ.get_template(data["popups"][popup]["template"])
                                    print "POPUP: adding {0} popup from core in {1}".format(data["popups"][popup]["template"], htmlfile)
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

    #generate header footer data firstly
    header_data, footer_data = _get_header_footer_data(templates_path)
    #generate the rest
    _create_html(templates_path["core"], templates_path, header_data, footer_data)
    _create_html(templates_path["project"], templates_path, header_data, footer_data)
    _generate_settings(templates_path["core"], templates_path, header_data, footer_data)

    for d in _get_plugins_templates():
        _create_html(d, templates_path, header_data, footer_data)

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
                            for dep in os.listdir(bower_comps):
                                local('cp {0}* {1}'.format(
                                    os.path.join(bower_comps, dep, 'js', ''),
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
                    project_branch='master'):
    """
    Install Cordova runtime

    platform - android or ios (android by default)
    dist_dir - directory for unpacking openlayers
    target - runtime root
    project_branch - project branch name
    """
    if platform == 'android':
        _check_commands(['android', 'ant'])
    _check_commands(['cordova', 'npm', 'bower', 'jshint', 'wget'])

    root, proj_home, src_dir = _get_source()

    # get config file
    _check_config()

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
                if clean_runtime(target) == False:
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

        # After prepare the project install the platform
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
                ol_tar = 'http://openlayers.org/download/%s' % ol_tar_file_name
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
                print name, version
                if version[:3] == 'git':
                    print "Must release with versioned fieldtrip plugin: {0}".format(name)
                    exit(1)

            file_name = '{0}.apk'.format(file_prefix)
            bin_dir = os.path.join(android_runtime, 'bin')
            apkfile = os.path.join(bin_dir, file_name)
            with lcd(android_runtime):
                local('ant clean release')

            # sign the application
            unsigned_apkfile = os.sep.join((bin_dir, '{0}-release-unsigned.apk'.format(file_prefix)))
            signed_apkfile = os.sep.join((bin_dir, '{0}-release-signed.apk'.format(file_prefix)))
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
                file_prefix))

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
def usage_stats():
    """
    Print out some usage stats.
    """
    host = _config('prime_host', section='common')
    if host:
        env.hosts = [host]
    else:
        print 'No prime host defined.'
        exit(0)
    print env
    execute('_app_start_stats')

@task
def release_ios():
    """
    Release ios version of fieldtrip app
    """

    # TODO
    print 'Waiting for someone to do this.'


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


@task
def _app_start_stats():
    """
    Print out android app start stats by version.
    """
    totals = {}
    def fetch_month(version):
        months = {}

        for i in range(1, 9):
            month = {}
            logname = "access_log.2014-{0}*".format(str(i).zfill(2))
            awk = "awk '{print $1}'"
            cmd = 'find /var/log/httpd/ -name {0} | xargs grep "Android {1}" | grep splash | {2}'.format(logname, version, awk)
            out = run(cmd)
            lines = out.split('\n')
            for l in lines:
                if len(l) == 0:
                    continue
                ip = l.split(':')[1].replace('\r', '')

                if ip in month:
                    month[ip]['count'] = month[ip]['count'] + 1
                else:
                    month[ip] = {
                        'number': len(lines),
                        'count': 1
                    }
            months[i] = month
        totals[version] = months

    versions = ['2.3', '4.0', '4.1', '4.2', '4.3', '4.4', '4.5']
    for version in versions:
        fetch_month(version)
    for version, months in totals.iteritems():
        print version,':'
        print 'Month'.ljust(10), 'Unique'.ljust(10), 'Total'.ljust(10)
        for i, month in months.iteritems():
            tcount = 0
            for ip, vals in month.iteritems():
                tcount = tcount + vals['count']
            print datetime.date(2014, i, 1).strftime('%B').ljust(10), str(len(month)).ljust(10), str(tcount).ljust(10)
        print '\n'

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
        port = _config('location_port')
        if port:
            local("rsync -avz -e 'ssh -p {0}' {1} {2}".format(
                port, location, conf_dir))
        else:
            local('rsync -avz {0} {1}'.format(location, conf_dir))
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
        out = local('npm install -g {0}@{1}'.format(cmd, version), capture=True)
        if out.return_code != 0:
            print 'Using sudo'
            local('sudo npm install -g {0}@{1}'.format(cmd, version))

def _is_empty(any_structure):
    # TODO
    if any_structure:
        return False
    else:
        return True

def _is_in_branch(repo, branch):
    # checks if a git repository is in a specific branch
    is_in_branch = False
    with lcd(repo):
        name = _get_branch_name(repo)
        if name == branch:
            is_in_branch = True
        else:
            dfb = '(detached from {0})'.format(branch)
            if dfb == name:
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

def _merge(a, b, path=None):
    """
    merges b into a

    #http://stackoverflow.com/questions/7204805/python-dictionaries-of-dictionaries-merge
    """
    if path is None: path = []
    for key in b:
        if key in a:
            if isinstance(a[key], dict) and isinstance(b[key], dict):
                if _is_empty(b[key]):
                    a[key] = b[key]
                else:
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

def _sorted(dic):
    """ TODO """
    dic = collections.OrderedDict(sorted(dic.items(), key=lambda t: t[0]))
    return dic

def _str2bool(v):
    """
    Convert v into boolean.
    """
    return v.lower() in ("yes", "true", "t", "1")

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
    """ TODO """
    f = open(fil, 'w')
    f.write(filedata.encode('utf-8'))
    f.close()

# import any project/plugin tasks
root = _get_source()[0]
proj_dir = _get_source()[1]
ptasks = [proj_dir]
plugins = os.path.join(root, 'plugins')
if os.path.exists(plugins):
    for plugin in os.listdir(plugins):
        ptasks.append(os.path.join(root, 'plugins', plugin))
for ptask in ptasks:
    if os.path.exists(os.path.join(ptask, 'fabtasks.py')):
        sys.path.append(ptask)
        import fabtasks
