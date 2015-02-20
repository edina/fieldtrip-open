import collections
import json
import os
import re
import sys
from copy import deepcopy
from bs4 import BeautifulSoup
from jinja2 import Environment, FileSystemLoader

class HtmlGenerator(object):

    def __init__(self, platform, cordova, root, proj_home, src_dir, config, settings_config):
        self.platform = platform
        self.cordova = cordova
        self.root = root
        self.proj_home = proj_home
        self.src_dir = src_dir
        self.export_path = os.sep.join((src_dir, 'www'))
        self.plugin_templates = self._get_plugins_templates()
        self.config = config
        self.settings_config = settings_config

    def generate(self):
        '''
        generate the templates
        '''
        #the jinja templates of core, the jinja project templates, the jinja templates of plugins
        templates_path = {
            "core": os.sep.join((self.src_dir, 'templates')), "project":
            os.path.join(self.proj_home, 'src', 'templates'),
            "plugins": self.plugin_templates
        }
        #generate header footer data firstly
        header_data, footer_data = self._get_header_footer_data(templates_path)
        #generate the rest
        self._create_html(templates_path["core"], templates_path, header_data, footer_data)
        self._create_html(templates_path["project"], templates_path, header_data, footer_data)
        self._generate_settings(templates_path["core"], templates_path, header_data, footer_data)

        for d in self.plugin_templates:
            self._create_html(d, templates_path, header_data, footer_data)

    def _check_for_data(self, paths, filename):
        '''
        check if file exists in any of the paths
        '''
        _in_plugins = []
        for d in paths["plugins"]:
            if os.path.exists(os.path.join(d, filename)):
                _in_plugins.append(d)
        return _in_plugins

    def _check_for_template(self, name):
        '''
        check if template exists inside the paths
        '''
        res = []
        for t in self.plugin_templates:
            if name in os.listdir(t):
                res.append(t)
        return res

    def _create_html(self, current_path, paths, header_data, footer_data):
        environ = Environment(loader=FileSystemLoader(current_path))
        environ_core = Environment(loader=FileSystemLoader(paths["core"]))
        environ_project = Environment(loader=FileSystemLoader(paths["project"]))
        environ.globals["_get_letter"] = self._get_letter
        environ_project.globals["_get_letter"] = self._get_letter

        header_template = environ_core.get_template("header.html")
        footer_template = environ_core.get_template("footer.html")

        for path, dirs, files in os.walk(current_path):
            for f in files:
                if self._is_valid_file(f):
                    htmlfile = '{0}.html'.format(f.split(".")[0])
                    htmlfilepath = os.path.join(path, htmlfile)
                    jsonfilepath = os.path.join(path, f)

                    data = None
                    if current_path == paths["core"]:
                        #check if the same json exists in any of the plugins and merge it
                        data_in_plugins = self._check_for_data(paths, f)
                        if len(data_in_plugins)>0:
                            for p in data_in_plugins:
                                if data == None:
                                    data = self._get_data(current_path, f, p)
                                else:
                                    self._merge(data, self._get_data(current_path, f, p))

                    #merge with the data in json
                    if data:
                        self._do_merge(f, data, paths["project"])
                    else:
                        data = self._get_data(current_path, f, paths["project"])

                    #generate templates:
                    if "templates" in data:
                        self._generate_templates(environ, data["templates"])

                    if os.path.exists(htmlfilepath):
                        print "generating file {0}".format(htmlfile)

                        if "header" in data:
                            self._merge(data["header"], header_data)
                        else:
                            data["header"] = header_data

                        if "footer" in data:
                            if not _is_empty(data["footer"]):
                                footer_data2 = deepcopy(footer_data)
                                data["footer"] = self._merge(footer_data2, data["footer"])
                        else:
                            data["footer"] = footer_data

                        if "body" in data:
                            body = self._sorted(data["body"])
                        else:
                            body=""

                        template = environ.get_template(htmlfile)
                        indexheader_data = {"cordova": self.cordova, "title": header_data["title"]}

                        popups=[]
                        if "popups" in data:
                            for popup in data["popups"]:
                                res = self._check_for_template(data["popups"][popup]["template"])
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
                            platform=self.platform,
                            header=header_template.render(
                                data=data["header"],
                                platform=self.platform),
                            footer=footer_template.render(
                                    data=data["footer"],
                                    platform=self.platform))
                        self._write_data(os.sep.join((self.export_path, htmlfile)), self._prettify(output, 2))

    def _do_merge(self, filename, data, path):
        '''
        function for merging data tha exist in different places
        e.g.
        '''
        if os.path.exists(path) and filename in os.listdir(path):
            with open(os.path.join(path, filename), 'r') as f:
                new_data = json.load(f, object_pairs_hook=collections.OrderedDict)
            print "DATA: merging {0}".format(os.path.join(path, filename))
            return self._merge(data, new_data)
        else:
            return data

    def _find_template(self, name):
        '''
        find template
        '''
        pths = {}
        for t in self._check_for_template(name):
            paths = t.split("/")
            pths[paths[len(paths)-3]]=t
        return pths

    def _generate_settings(self, current_path, paths, header_data, footer_data):
        '''
        generate setttings page
        '''
        environ = Environment(loader=FileSystemLoader(current_path))
        settings=[]
        #get all the settings templates from plugins
        settings_in_plugins = self._find_template('settings.html')
        if os.path.exists(os.path.join(paths["project"], 'settings.html')):
            settings_in_plugins["project"] = paths["project"]

        for plg in settings_in_plugins:
            settings_path = settings_in_plugins[plg]
            environ_settings = Environment(loader=FileSystemLoader(settings_path))
            tmpl = environ_settings.get_template('settings.html')
            data = {}
            if self.settings_config is not None:
                #this is needed for when the plugins come through bower
                if "fieldtrip-" in plg:
                    plg = plg.replace("fieldtrip-", "")
                if plg in self.settings_config.keys():
                    value = self.settings_config[plg]
                    if value.startswith('{'):
                        data = json.loads(value, object_pairs_hook=collections.OrderedDict)
                    else:
                        data = value
            settings.append(tmpl.render(settings=data))

        header_template = environ.get_template("header.html")
        footer_template = environ.get_template("footer.html")
        template  = environ.get_template('settings.html')
        output = template.render(settings="\n".join(settings),
                            config = self.config,
                            header=header_template.render(
                                data=header_data,
                                platform=self.platform),
                            footer=footer_template.render(
                                    data=footer_data,
                                    platform=self.platform))
        self._write_data(os.sep.join((self.export_path, 'settings.html')), self._prettify(output, 2))

    def _generate_templates(self, environ, templates):
        for templ in templates:
            print "TEMPLATE: generating template {0}".format(templates[templ])
            script_template = environ.get_template(templates[templ])
            self._write_data(os.path.join(self.export_path, 'templates', templates[templ]), script_template.render())

    def _get_data(self, path1, filename, path2):
        '''
        get data from different two paths and merge them
        '''
        with open(os.path.join(path1, filename),'r') as f:
            try:
                json_object = json.load(f, object_pairs_hook=collections.OrderedDict)
                return self._do_merge(filename, json_object, path2)
            except ValueError, e:
                print "There was problem with the json file {0}".format(os.path.join(path1, filename))
                sys.exit()

    def _get_letter(self, obj):
        '''
        Get the letter that corresponds to column in a jqm grid view based on the
        number of elements in obj: see http://api.jquerymobile.com/1.3/grid-layout/
        '''

        letter = 'a'
        if len(obj) > 1:
            i = len(obj) - 2
            letter = chr(i + ord('a'))

        return letter

    def _get_header_footer_data(self, templates_path):
        '''
        get header and footer data
        '''
        header_data = self._get_data(templates_path["core"], 'header.json', templates_path["project"])
        footer_data = self._get_data(templates_path["core"], 'footer.json', templates_path["project"])
        for d in templates_path["plugins"]:
            if os.path.exists(os.path.join(d, 'header.json')):
                self._do_merge('header.json', header_data, d)
            if os.path.exists(os.path.join(d, 'footer.json')):
                self._do_merge('footer.json', footer_data, d)
        return header_data, footer_data

    def _get_plugins_templates(self):
        '''
        get a list of directories with templates
        '''
        plugins_list = []
        #check the folders inside the plugins folder and check for templates folders
        for d in os.listdir(os.path.join(self.root, 'plugins')):
            d1 = os.path.join(self.root, 'plugins', d)
            for dire in os.listdir(d1):
                p = os.path.join(d1, dire)
                if os.path.isdir(p) and not dire.startswith("."):
                    tmpl_path = os.path.join(p, "templates")
                    if os.path.exists(tmpl_path):
                        plugins_list.append(tmpl_path)

        #check for plugins inside the project.json of the project folder in case there are bower plugins
        with open(os.path.join(self.src_dir, 'www', 'theme', 'project.json'),'r') as f:
            plgins = json.load(f)["plugins"]
            for k, v in plgins["fieldtrip"].iteritems():
                if re.match('^v?\d+.\d+.\d+', v):
                    tmpl_path = os.path.join('bower_components', 'fieldtrip-{0}'.format(k), 'src', 'templates')
                    if os.path.exists(tmpl_path):
                        plugins_list.append(os.path.join('bower_components', 'fieldtrip-{0}'.format(k), 'src', 'templates'))
        return plugins_list

    def _is_empty(self, any_structure):
        # TODO
        if any_structure:
            return False
        else:
            return True

    def _is_valid_file(self, f):
        return f.endswith("json") and not f in ["header.json", "footer.json", "settings.json"]

    def _merge(self, a, b, path=None):
        '''
        merges b into a
        #http://stackoverflow.com/questions/7204805/python-dictionaries-of-dictionaries-merge
        '''
        if path is None: path = []
        for key in b:
            if key in a:
                if isinstance(a[key], dict) and isinstance(b[key], dict):
                    if self._is_empty(b[key]):
                        a[key] = b[key]
                    else:
                        self._merge(a[key], b[key], path + [str(key)])
                elif a[key] == b[key]:
                    pass # same leaf value
                else:
                    a[key] = b[key]
            else:
                a[key] = b[key]
        return a

    def _prettify(self, output, indent='2'):
        '''
        custom indentation for BeautifulSoup
        '''
        soup = BeautifulSoup(output, "html5lib")
        if len(soup.findAll('script')) > 0:
            s = soup.prettify()
        else:
            s = soup.div.prettify()
        r = re.compile(r'^(\s*)', re.MULTILINE)
        return r.sub(r'\1\1', s)

    def _sorted(self, dic):
        '''
        sort letters
        dic --> dictionary
        '''
        dic = collections.OrderedDict(sorted(dic.items(), key=lambda t: t[0]))
        return dic

    def _write_data(self, fil, filedata):
        '''
        fil --> filename
        filedata --> content that will be written in filename
        '''
        f = open(fil, 'w')
        f.write(filedata.encode('utf-8'))
        f.close()
