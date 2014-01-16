Available via the MIT or new BSD license.
see: http://github.com/requirejs/text for details


parseName(name)
---------------
Parses a resource name into its component parts. Resource names
look like: module/name.ext!strip, where the !strip part is
optional.
where strip is a boolean.


**Parameters**

**name**:  *String*,  the resource name

**Returns**

*Object*,  with properties "moduleName", "ext" and "strip"

useXhr(url)
-----------
Is an URL on another domain. Only works for browser use, returns
false in non-browser environments. Only used to know if an
optimized .js version of a text resource should be loaded
instead.


**Parameters**

**url**:  *String*,  


**Returns**

Boolean

