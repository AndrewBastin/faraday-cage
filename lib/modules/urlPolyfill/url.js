(function(global) {
  // URL polyfill implementation
  function URL(url, base) {
    if (!(this instanceof URL)) {
      throw new TypeError("Failed to construct 'URL': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
    }

    const parseUrl = (urlString, base) => {
      const parsed = {
        href: "",
        protocol: "",
        username: "",
        password: "",
        host: "",
        hostname: "",
        port: "",
        pathname: "",
        search: "",
        hash: "",
        origin: ""
      };

      try {
        let fullUrl = urlString;
        
        if (base && !urlString.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
          const baseUrl = parseUrl(base);
          if (!baseUrl.href) throw new TypeError("Invalid base URL");
          
          if (urlString.indexOf("//") === 0) {
            fullUrl = baseUrl.protocol + urlString;
          } else if (urlString.charAt(0) === "/") {
            fullUrl = baseUrl.protocol + "//" + baseUrl.host + urlString;
          } else if (urlString.charAt(0) === "?") {
            fullUrl = baseUrl.protocol + "//" + baseUrl.host + baseUrl.pathname + urlString;
          } else if (urlString.charAt(0) === "#") {
            fullUrl = baseUrl.protocol + "//" + baseUrl.host + baseUrl.pathname + baseUrl.search + urlString;
          } else {
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf("/") + 1);
            fullUrl = baseUrl.protocol + "//" + baseUrl.host + basePath + urlString;
          }
        }

        const protocolMatch = fullUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
        if (!protocolMatch) {
          throw new TypeError("Invalid URL");
        }

        parsed.protocol = protocolMatch[1] + ":";
        let remaining = fullUrl.substring(protocolMatch[0].length);

        const authMatch = remaining.match(/^([^:@]+)(?::([^@]*))?@/);
        if (authMatch) {
          parsed.username = decodeURIComponent(authMatch[1] || "");
          parsed.password = decodeURIComponent(authMatch[2] || "");
          remaining = remaining.substring(authMatch[0].length);
        }

        const hostMatch = remaining.match(/^([^\/\?#]+)/);
        if (hostMatch) {
          const hostPart = hostMatch[1];
          const portMatch = hostPart.match(/:(\d+)$/);
          
          if (portMatch) {
            parsed.hostname = hostPart.substring(0, hostPart.length - portMatch[0].length);
            parsed.port = portMatch[1];
            
            const defaultPorts = {
              "http:": "80",
              "https:": "443",
              "ftp:": "21",
              "ws:": "80",
              "wss:": "443"
            };
            
            if (defaultPorts[parsed.protocol] === parsed.port) {
              parsed.port = "";
              parsed.host = parsed.hostname;
            } else {
              parsed.host = parsed.hostname + ":" + parsed.port;
            }
          } else {
            parsed.hostname = hostPart;
            parsed.host = hostPart;
          }
          
          remaining = remaining.substring(hostMatch[0].length);
        }

        const pathMatch = remaining.match(/^([^\?#]*)/);
        if (pathMatch) {
          parsed.pathname = pathMatch[1] || "/";
          if (parsed.pathname.charAt(0) !== "/") {
            parsed.pathname = "/" + parsed.pathname;
          }
          parsed.pathname = encodeURI(decodeURIComponent(parsed.pathname)).replace(/%2F/g, "/");
          remaining = remaining.substring(pathMatch[0].length);
        }

        const queryMatch = remaining.match(/^(\?[^#]*)/);
        if (queryMatch) {
          parsed.search = queryMatch[1];
          parsed.search = "?" + encodeURI(decodeURIComponent(parsed.search.substring(1))).replace(/%20/g, "%20");
          remaining = remaining.substring(queryMatch[0].length);
        }

        if (remaining.charAt(0) === "#") {
          parsed.hash = remaining;
        }

        parsed.origin = parsed.protocol + "//" + parsed.host;
        
        const auth = parsed.username ? 
          parsed.username + (parsed.password ? ":" + parsed.password : "") + "@" : "";
        
        parsed.href = parsed.protocol + "//" + auth + parsed.host + parsed.pathname + parsed.search + parsed.hash;

        return parsed;
      } catch (e) {
        throw new TypeError("Invalid URL");
      }
    };

    const parsed = parseUrl(url, base);
    let searchParams = null;

    const updateHref = () => {
      const auth = parsed.username ? 
        encodeURIComponent(parsed.username) + 
        (parsed.password ? ":" + encodeURIComponent(parsed.password) : "") + "@" : "";
      
      parsed.href = parsed.protocol + "//" + auth + parsed.host + 
        parsed.pathname + parsed.search + parsed.hash;
    };

    Object.defineProperty(this, "href", {
      get: () => parsed.href,
      set: (value) => {
        const newParsed = parseUrl(value);
        Object.assign(parsed, newParsed);
        searchParams = null;
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "protocol", {
      get: () => parsed.protocol,
      set: (value) => {
        if (value.charAt(value.length - 1) !== ":") value += ":";
        parsed.protocol = value;
        parsed.origin = parsed.protocol + "//" + parsed.host;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "username", {
      get: () => parsed.username,
      set: (value) => {
        parsed.username = value;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "password", {
      get: () => parsed.password,
      set: (value) => {
        parsed.password = value;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "host", {
      get: () => parsed.host,
      set: (value) => {
        const portMatch = value.match(/:(\d+)$/);
        if (portMatch) {
          parsed.hostname = value.substring(0, value.length - portMatch[0].length);
          parsed.port = portMatch[1];
          
          const defaultPorts = {
            "http:": "80",
            "https:": "443",
            "ftp:": "21",
            "ws:": "80",
            "wss:": "443"
          };
          
          if (defaultPorts[parsed.protocol] === parsed.port) {
            parsed.port = "";
            parsed.host = parsed.hostname;
          } else {
            parsed.host = value;
          }
        } else {
          parsed.hostname = value;
          parsed.host = value;
          parsed.port = "";
        }
        parsed.origin = parsed.protocol + "//" + parsed.host;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "hostname", {
      get: () => parsed.hostname,
      set: (value) => {
        parsed.hostname = value;
        parsed.host = parsed.port ? 
          value + ":" + parsed.port : value;
        parsed.origin = parsed.protocol + "//" + parsed.host;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "port", {
      get: () => parsed.port,
      set: (value) => {
        parsed.port = value;
        parsed.host = value ? 
          parsed.hostname + ":" + value : parsed.hostname;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "pathname", {
      get: () => parsed.pathname,
      set: (value) => {
        if (value.charAt(0) !== "/") value = "/" + value;
        parsed.pathname = encodeURI(decodeURIComponent(value)).replace(/%2F/g, "/");
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "search", {
      get: () => parsed.search,
      set: (value) => {
        if (value && value.charAt(0) !== "?") value = "?" + value;
        parsed.search = value;
        searchParams = null;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "hash", {
      get: () => parsed.hash,
      set: (value) => {
        if (value && value.charAt(0) !== "#") value = "#" + value;
        parsed.hash = value;
        updateHref();
      },
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "origin", {
      get: () => parsed.origin,
      enumerable: true,
      configurable: true
    });

    Object.defineProperty(this, "searchParams", {
      get: () => {
        if (!searchParams) {
          searchParams = new URLSearchParams(parsed.search);
          
          const originalToString = searchParams.toString;
          searchParams.toString = function() {
            const result = originalToString.call(this);
            const newSearch = result ? "?" + result : "";
            if (newSearch !== parsed.search) {
              parsed.search = newSearch;
              updateHref();
            }
            return result;
          };
          
          ["append", "delete", "set", "sort"].forEach(method => {
            const original = searchParams[method];
            searchParams[method] = function(...args) {
              const result = original.apply(this, args);
              const newSearch = this.toString();
              const searchString = newSearch ? "?" + newSearch : "";
              if (searchString !== parsed.search) {
                parsed.search = searchString;
                updateHref();
              }
              return result;
            };
          });
        }
        return searchParams;
      },
      enumerable: true,
      configurable: true
    });

    this.toString = function() {
      return parsed.href;
    };

    this.toJSON = function() {
      return parsed.href;
    };
  }

  // URLSearchParams polyfill implementation
  function URLSearchParams(init) {
    if (!(this instanceof URLSearchParams)) {
      throw new TypeError("Failed to construct 'URLSearchParams': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
    }

    const params = [];

    const append = (name, value) => {
      params.push([String(name), String(value)]);
    };

    const getIndex = (name) => {
      return params.findIndex(([n]) => n === name);
    };

    if (init) {
      if (typeof init === "string") {
        const searchString = init.charAt(0) === "?" ? init.substring(1) : init;
        searchString.split("&").forEach(pair => {
          if (pair) {
            const [key, value] = pair.split("=");
            append(
              decodeURIComponent(key.replace(/\+/g, " ")),
              value !== undefined ? decodeURIComponent(value.replace(/\+/g, " ")) : ""
            );
          }
        });
      } else if (init && typeof init === "object") {
        if (init instanceof URLSearchParams) {
          init.forEach((value, key) => {
            append(key, value);
          });
        } else if (Array.isArray(init)) {
          init.forEach(pair => {
            if (Array.isArray(pair) && pair.length === 2) {
              append(pair[0], pair[1]);
            }
          });
        } else {
          Object.keys(init).forEach(key => {
            append(key, init[key]);
          });
        }
      }
    }

    this.append = function(name, value) {
      append(name, value);
    };

    this.delete = function(name) {
      let i = params.length;
      while (i--) {
        if (params[i][0] === name) {
          params.splice(i, 1);
        }
      }
    };

    this.get = function(name) {
      const index = getIndex(name);
      return index !== -1 ? params[index][1] : null;
    };

    this.getAll = function(name) {
      return params.filter(([n]) => n === name).map(([, v]) => v);
    };

    this.has = function(name) {
      return getIndex(name) !== -1;
    };

    this.set = function(name, value) {
      const index = getIndex(name);
      if (index !== -1) {
        params[index][1] = String(value);
        let i = params.length;
        while (i-- > index + 1) {
          if (params[i][0] === name) {
            params.splice(i, 1);
          }
        }
      } else {
        append(name, value);
      }
    };

    this.sort = function() {
      params.sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
      });
    };

    this.toString = function() {
      return params.map(([name, value]) => {
        const encodedName = encodeURIComponent(name).replace(/%20/g, "+");
        const encodedValue = encodeURIComponent(value).replace(/%20/g, "+");
        return encodedName + "=" + encodedValue;
      }).join("&");
    };

    this.forEach = function(callback, thisArg) {
      params.forEach(([key, value]) => {
        callback.call(thisArg, value, key, this);
      });
    };

    this.entries = function*() {
      for (const pair of params) {
        yield pair;
      }
    };

    this.keys = function*() {
      for (const [key] of params) {
        yield key;
      }
    };

    this.values = function*() {
      for (const [, value] of params) {
        yield value;
      }
    };

    this[Symbol.iterator] = this.entries;
  }

  // Make constructors available globally
  global.URL = URL;
  global.URLSearchParams = URLSearchParams;
})(
  typeof self !== "undefined" && self ||
  typeof window !== "undefined" && window ||
  typeof global !== "undefined" && global ||
  this
);
