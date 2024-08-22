// Abstract away all the stupid details required to inherit Error types
export function ErrorTypeFactory(name, f) {
  if (typeof f === 'undefined') {
    // At the very least, set the message correctly
    f = function(message) {
      this.message = message;
    }
  }
  const newError = function() {
    const error = Error.apply(this, arguments);

    error.name = this.name = name;
    this.stack = error.stack;
    f.apply(this, arguments);
  }
  newError.prototype = Object.create(Error.prototype);
  newError.prototype.constructor = f;
  return newError;
}

export const NotEnoughArgumentsError = ErrorTypeFactory('NotEnoughArgumentsError');

// Raise an error if an object is not of the expected type
function expect_type(value, type) {
  if (!(value instanceof type)) {
    throw new TypeError('Expected type ' + type.constructor.name);
  }
}

// A strict version of obj[name] that throws errors when the key isn't found
function get(obj, name) {
  const value = obj[name];
  if (typeof value === 'undefined') {
    throw new TypeError(`${name} is not a valid value in ${Object.keys(obj)}`);
  }
  return value;
}

// Constructor for objects representing Site URLs.
export function Site(url) {
  if (!(this instanceof Site)) {
    if (!url) {
      return Site.none;
    }
    return new Site(url);
  }

  function toURL(site) {
    if (site instanceof URL) return site;
    try {
      return new URL(site.includes("://") ? site : "http://" + site);
    } catch {
      throw new TypeError(`Error constructing URL from ${site}`);
    }
  }

  const url_object = toURL(url)
  const host_components = url_object.host.split('.');
  // convert "sub2.sub1.example.com" to "['example.com', 'sub1', 'sub2']"
  this.domain_hierarchy = [host_components.slice(-2).join('.')].concat(
      host_components.slice(0, -2).reverse());
  // convert "/path/to/resource.html" to "['path', 'to', 'resource.html']"
  this.page_hierarchy = url_object.pathname.split('/').filter(
      function(x) { return Boolean(x); });
  this.protocol = url_object.protocol
  this.toString = function() {
    return (url_object.host ?? "") + url_object.pathname;
  };
}
Site.build = function(domain_hierarchy, page_hierarchy, protocol) {
  page_hierarchy = typeof page_hierarchy !== 'undefined' ? page_hierarchy
    : [];
  protocol = typeof protocol !== 'undefined' ? protocol : 'http:';
  return new Site(protocol + '//' +
                  domain_hierarchy.slice(0).reverse().join('.') + '/' +
                  page_hierarchy.join('/'))
}
Site.none = (function() {
  const none = Object.create(Site.prototype);
  none.domain_hierarchy = [];
  none.page_hierarchy = [];
  none.toString = () => "";
  return none;
})();

// Constructor for an object that stores hierarchical data and retrieves the
// most-specific data available.
export function Hierarchy() {
  if (!(this instanceof Hierarchy)) {
    return new Hierarchy();
  }
  // This is the special key interpreted as the data for a position in the
  // hierarchy, rather than a child name.
  const DATA = '/';

  this.tree = {};

  // Search for the closest path in the hierarchy that matches the given chain.
  this.getMatch = function(chain) {
    const route = [];
    let selection = this.tree;
    let last_route = [];
    for (let i = 0; i < chain.length; ++i) {
      if (!(chain[i] in selection)) {
        break;
      }
      route.push(chain[i]);
      selection = selection[chain[i]];
      if (typeof selection[DATA] !== 'undefined') {
        last_route = [...route];
      }
    }
    return last_route;
  };

  // Get the closest object in the hierarchy that matches the given chain.
  this.get = function(chain) {
    let selection = this.tree;
    let last_data = this.tree[DATA];
    for (let i = 0; i < chain.length; ++i) {
      if (!(chain[i] in selection)) {
        break;
      }
      selection = selection[chain[i]];
      if (typeof selection[DATA] !== 'undefined') {
        last_data = selection[DATA];
      }
    }
    return last_data;
  };

  // Get the exact object in the hierarchy if it exists.
  this.get_exact = function(chain) {
    let selection = this.tree;
    for (let i = 0; i < chain.length; ++i) {
      if (!(chain[i] in selection)) {
        return undefined;
      }
      selection = selection[chain[i]];
    }
    return selection[DATA];
  };

  // Set a piece of data in the hierarchy
  this.set = function(chain, value) {
    let selection = this.tree;
    for (let i = 0; i < chain.length; ++i) {
      if (typeof selection[chain[i]] !== 'object') {
        selection[chain[i]] = {};
      }
      selection = selection[chain[i]];
    }
    selection[DATA] = value;
  }

  // Remove the object in the hierarchy matching the chain
  this.remove = function(chain) {
    let selection = this.tree;
    for (let i = 0; i < chain.length && typeof selection !== 'undefined'; ++i) {
      selection = selection[chain[i]];
    }
    if (typeof selection !== 'undefined') {
      selection[DATA] = undefined;
    }
  };

  // Read a list of addresses + data into this tree
  this.load = function(tree_dump) {
    const that = this;
    tree_dump.forEach(function(entry) {
      that.set(entry.address, entry.data);
    });
  }

  // Convert a tree into a list of addresses + data
  this.dump = function() {
    return dump_tree(this.tree);
  }

  // Walk a subtree, flattening its component subtrees into a single list
  const dump_tree = function(root, address) {
    address = typeof address !== 'undefined' ? address : [];
    const list = []
    // Add the subtrees
    Object.keys(root).forEach(function(key) {
      if (typeof root[key] === 'undefined') { return; }
      // Add the current node's data if we see it
      if (key === DATA) {
        list.push({ address: address, data: root[DATA] });
        return;
      }
      // Add the dump of each subtree
      Array.prototype.push.apply(list, dump_tree(root[key], address.concat([key])));
    });
    return list;
  }
}

// Constructor for the global Settings object which stores site-specific
// settings in a hierarchy.
export function Settings(defaultFilter, defaultMods) {
  if (!(this instanceof Settings)) {
    return new Settings(defaultFilter, defaultMods);
  }

  this.storage = new Hierarchy();
  this.fileStorage = new Hierarchy();

  this.save = function(site, site_settings) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    expect_type(site_settings, SiteSettings);
    if (site.protocol === "file:") {
      this.fileStorage.set(site.page_hierarchy, site_settings);
      return;
    }
    let site_domain = this.storage.get_exact(site.domain_hierarchy);
    if (!(site_domain instanceof Hierarchy)) {
      site_domain = new Hierarchy();
      this.storage.set(site.domain_hierarchy, site_domain);
    }
    site_domain.set(site.page_hierarchy, site_settings);
  };

  this.remove = function(site) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    if (site.protocol === "file:") {
      this.fileStorage.remove(site.page_hierarchy);
      return;
    }
    const site_domain = this.storage.get_exact(site.domain_hierarchy);
    if (!(site_domain instanceof Hierarchy)) {
      return;
    }
    site_domain.remove(site.page_hierarchy);
  };

  this.match = function(site) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    if (site.protocol === "file:") {
      return Site.build(
        site.domain_hierarchy,
        this.fileStorage.getMatch(site.page_hierarchy),
        "file:",
      );
    }
    const closest_path = this.storage.getMatch(site.domain_hierarchy);
    const domain_path = closest_path.length > 0 ? closest_path : site.domain_hierarchy;
    const site_domain = this.storage.get(site.domain_hierarchy);
    if (site_domain instanceof Hierarchy) {
      return Site.build(
        domain_path,
        site_domain.getMatch(site.page_hierarchy),
      );
    }
    return Site.build(domain_path);
  }

  this.load = function(site) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    if (site.protocol === "file:") {
      const settings = this.fileStorage.get(site.page_hierarchy) ?? this.site_default();
      return settings;
    }
    const site_domain = this.storage.get(site.domain_hierarchy);
    if (site_domain instanceof Hierarchy) {
      return site_domain.get(site.page_hierarchy) ?? this.site_default();
    }
    return site_domain;
  }

  // Helper function for setting the root element
  this.set_site_default = function(site_settings) {
    this.save(Site.none, site_settings);
  }
  // Helper function for getting the root element
  this.site_default = function() {
    return this.load(Site.none);
  }

  // Serialize the settings in a form that can be efficiently stored with
  // chrome.storage
  this.export = function() {
    const list = [];
    this.storage.dump().forEach(function(domain_item) {
      const domain_hierarchy = domain_item.address;
      Array.prototype.push.apply(list,
        domain_item.data.dump().map(function(page_item) {
          const site = domain_hierarchy.length === 0 ? Site.none
            : Site.build(domain_hierarchy, page_item.address);
          const {filter, mods} = page_item.data;
          return [ site.toString(), filter, ...mods ];
        })
      );
    });
    return list;
  }

  // Serialize local settings in a form that can be efficiently stored with
  // chrome.storage
  this.exportLocal = function() {
    const list = this.fileStorage.dump().map(function(page_item) {
      const site = Site.build([], page_item.address, "file:");
      const {filter, mods} = page_item.data;

      return [ "file://" + site.toString(), filter, ...mods ];
    })
    return list;
  }

  this.import = function(settings_list) {
    settings_list ??= [];
    settings_list.forEach(([site, filter, ...mods]) => {
      if (typeof site === 'undefined' || typeof filter === 'undefined') {
        throw new Error(`Invalid settings list format.`);
      }
      try {
        this.save(site, new SiteSettings(filter, mods));
      } catch (err) {
        console.log(err);
      }
    });
  }

  if (typeof defaultFilter != 'undefined') {
    this.set_site_default(new SiteSettings(defaultFilter, defaultMods ?? []))
  }
}
// Read the serialized settings data
Settings.import = function(settings_list, defaultFilter, defaultMods) {
  const settings = new Settings(defaultFilter, defaultMods);
  settings.import(settings_list);
  if (!settings.site_default()) {
    throw new Error(`Imported data did not include a default. ${JSON.stringify(settings)}`);
  }
  return settings;
}

export const Filter = Object.freeze({
  smart: 'delumine-smart',
  noimg: 'delumine-noimg',
  all: 'delumine-all',
  "low-contrast": 'noinvert-low-contrast',
  dim1: 'noinvert-dim1',
  dim2: 'noinvert-dim2',
  dim3: 'noinvert-dim3',
  dim4: 'noinvert-dim4',
  dim5: 'noinvert-dim5',
  normal: 'normal'
});

export const Modifier = Object.freeze({
  low_contrast: 'low-contrast',
  killbg: 'kill_background',
  forceinput: 'force_text',
  dynamic: 'dynamic',
  ignorebg: 'ignorebg',
});

export function SiteSettings(filter, mods) {
  if (!(this instanceof SiteSettings)) {
    return new SiteSettings(filter, mods);
  }
  if (typeof filter === 'undefined') {
    throw new NotEnoughArgumentsError('filter object is required');
  }
  mods = typeof mods !== 'undefined' ? [...mods] : [];
  // Just verify that the arguments represent actual things
  get(Filter, filter);
  for (const mod of mods) {
    get(Modifier, mod);
  }
  this.filter = filter;
  this.mods = new Set(mods);
  this.equals = function(that) {
    if (!(that instanceof SiteSettings)) {
      return false;
    }
    return (
      this.filter === that.filter &&
      this.mods.size === that.mods.size &&
      [...this.mods].every(mod => that.mods.has(mod))
    );
  }
}

// vim: et ts=2 sts=2 sw=2
