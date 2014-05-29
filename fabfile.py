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
from copy import copy, deepcopy

import xml.etree.ElementTree as ET

import ast
import codecs
import ConfigParser
import json
import os
import smtplib
import re, itertools
import collections, sys


CORDOVA_VERSION    = '3.3.1-0.4.2'
OPENLAYERS_VERSION = '2.12'
PROJ4JS_VERSION    = '1.1.0'
NPM_VERSION        = '1.4.10'
BOWER_VERSION      = '1.3.3'
JSHINT_VERSION     = '2.5.0'

"""
Tools installed via npm.
The v_search value is the expected output of running the command -v
"""
npm_commands = {
    'npm':{
        'version': NPM_VERSION
    },
    'cordova':{
        'version': CORDOVA_VERSION,
    },
    'bower':{
        'version': BOWER_VERSION,
    },
    'jshint':{
        'version': JSHINT_VERSION,
        'v_search': 'jshint v{0}'.format(JSHINT_VERSION)
    }
}

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
    _check_command('ant')
    _check_command('adb')
    _check_command('cordova')

    # generate html for android
    generate_html(platform="ios",cordova=True)

    with lcd(_get_runtime()[1]):
        device = None
        local('cordova build ios')

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

    values = dict(config.items('app'))
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
            if settings_config != None:
                if plg in settings_config:
                    value = settings_config[plg]
                    if value.startswith('{'):
                        data = json.loads(value, object_pairs_hook=collections.OrderedDict)
                        #print data
                    else:
                        data = value
            settings.append(tmpl.render(settings=data))

        header_template = environ.get_template("header.html")
        footer_template = environ.get_template("footer.html")
        template  = environ.get_template('settings.html')
        output = template.render(settings="\n".join(settings),
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
        #environ.globals["_sorted"] = _sorted

        header_template = environ_core.get_template("header.html")
        footer_template = environ_core.get_template("footer.html")
        #print current_path

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
                                data = _get_data(current_path, f, p)

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
                                #print data["popups"][popup]["template"]
                                res = _check_for_template(data["popups"][popup]["template"])
                                #print len(res)
                                if len(res) == 1:
                                    environ_popup = Environment(loader=FileSystemLoader(res[0]))
                                    popup_template = environ_popup.get_template(data["popups"][popup]["template"])
                                    print "POPUP: adding {0} popup from plugins in {1}".format(data["popups"][popup]["template"], htmlfile)
                                elif len(res) > 1:
                                    print "There popup template {0} exists more than once. This needs to be fixed.".format(data["popups"][popup]["template"], )
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
    json_file = os.sep.join((theme, 'project.json'))
    if os.path.exists(json_file):
        pobj = json.loads(open(json_file).read())['plugins']

        if _str2bool(cordova):
            with lcd(runtime):
                # do cordova plugins
                for name in pobj['cordova']:
                    local('cordova plugin add {0}'.format(name))

        # do fieldtrip plugins
        proot = os.sep.join((root, 'plugins'))
        for plugin, details in pobj['fieldtrip'].iteritems():
            dest = os.sep.join((asset_dir, 'plugins', plugin))

            if details[0:14] == 'https://github':
                # if repository given in https:// format convert to git@
                print 'Converting {0} to '.format(details)
                details = 'git@{0}.git'.format(details[8:]).replace('/', ':', 1)
                print details

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
                        with lcd(plugin):
                            local('ln -s {0} {1}'.format(
                                os.path.join(root, 'scripts', 'pre-commit.sh'),
                                os.path.join('.git', 'hooks', 'pre-commit')))

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
                    target='local',
                    project_branch='master'):
    """
    Install Cordova runtime

    platform - android or ios
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
    css_dir = os.sep.join(('www', 'css', 'ext'))

    if os.path.exists(runtime):
        # check if they want to delete existing installation
        msg = 'Directory {0} exists.\nDo you wish to delete it(Y/n)? > '.format(runtime)
        answer = raw_input(msg).strip()

        if len(answer) > 0 and answer.lower() != 'y':
            print 'Choosing not continue. Nothing installed.'
            return

        local('rm -rf {0}'.format(runtime))
    else:
        os.mkdir(runtime)

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
        print "\n*** WARNING: No project.json found in project"
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
    with lcd(target_dir):
        local('cordova create {0} {1} {1}'.format(
            runtime,
            _config('package', section='app'),
            _config('name')))

    with lcd(runtime):

        # add platform and cordova plugins
        local('cordova platform add {0}'.format(platform))

        # create sym link to assets
        local('rm -rf www')
        asset_dir =  os.sep.join((src_dir, 'www'))
        local('ln -s {0}'.format(asset_dir))

        # Replace default config.xml and symlink to our version
        local('rm config.xml')
        local('ln -s %s' % os.sep.join(('www','config.xml')))

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
    generate_config_js(version=versions['project'],
                       fetch_config=False)

    # set up cordova/fieldtrip plugins
    install_plugins(target)

    #add permissions for html5 geolocation, it might be not needed with the
    #next upgrade of cordova
    if platform == 'android':
        _add_permissions(os.path.join(runtime, 'platforms', platform))

    # add project specific files
    update_app()

    # process tempates
    generate_html(platform='desktop')

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
def install_project_ios():
    install_project(platform='ios')

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
    theme_src = os.sep.join((proj_home, 'theme'))
    with open(os.path.join(theme_src, 'project.json'), 'r') as f:
        pjson = json.load(f)
        versions = pjson["versions"]
        plugins = pjson["plugins"]

    with lcd(runtime):
        bin_dir = os.sep.join((runtime, 'platforms', 'android', 'bin'))
        apk_name = _config('package', section='app').replace('.', '')

        # do the build
        if _str2bool(beta):
            file_name = '{0}-debug.apk'.format(apk_name)
            new_file_name = '{0}-debug.apk'.format(_config('name'))
            local('cordova build')
        else:
            # check plugin and project versions
            if versions['core'] == 'master':
                print "\nCan't release with untagged core repository: {0}".format(
                    versions['core'])
                exit(1)
            if not _is_in_branch(proj_home, versions['project']):
                print "To release the project must be tagged with release version. project: {0}".format(versions['project'])

            for cplug in plugins['cordova']:
                if len(cplug.split('@')) != 2:
                    print "Must release with a versioned cordova plugin: {0}".format(cplug)
                    exit(1)
            for name, version in plugins['fieldtrip'].items():
                print name, version
                if version[:3] == 'git':
                    print "Must release with versioned fieldtrip plugin: {0}".format(name)
                    exit(1)

            file_name = '{0}.apk'.format(apk_name)
            new_file_name = '{0}.apk'.format(_config('name'))
            with lcd(os.sep.join((runtime, 'platforms', 'android'))):
                local('ant clean release')

            # sign the application
            unsigned_apkfile = os.sep.join((bin_dir, '{0}-release-unsigned.apk'.format(apk_name)))
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
    env.hosts = _config('hosts', section='release').split(',')
    version = versions['project']
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

def _add_permissions(platform):
    manifest = os.path.join(platform, 'AndroidManifest.xml')
    with open(manifest, 'r') as f:
        data = f.readlines()
        f.close()
    new_data = []
    i=0
    for l in data:
        new_data.append(l)
        if "uses-sdk android:minSdkVersion=" in l and i==0:
            new_data.append('\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />')
            new_data.append('\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n')
            i=i+1
    with open(manifest, 'w') as f:
        f.writelines(new_data)
        f.close()

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
    if location.find('@') != -1:
        port = _config('location_port')
        if port:
            local("rsync -avz -e 'ssh -p {0}' {1} {2}".format(
                port, location, conf_dir))
        else:
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

    if config.has_section(section):
        if key == None:
            return config._sections[section]
        else:
            val = None
            try:
                val = config.get(section, key)
            except ConfigParser.NoOptionError:
                pass
            return val
    else:
        return None

@task
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

def _generate_config_xml():
    """ generate config.xml """

    root, proj_home, src_dir = _get_source()
    theme_src = os.sep.join((proj_home, 'theme'))
    with open(os.path.join(theme_src, 'project.json'), 'r') as f:
        versions = json.load(f)["versions"]

    environ = Environment(loader=FileSystemLoader('etc'))
    config_template = environ.get_template("config.xml")
    version = versions['project']
    filedata = config_template.render(
        name=_config('name'),
        package=_config('package', section='app'),
        version=version,
        version_code=version.replace(".", ""),
        author_email=_config('author_email'),
        url=_config('url'),
        access_urls = _config('access_urls').split(","))
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
