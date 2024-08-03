// Abstract away all the stupid details required to inherit Error types
export function ErrorTypeFactory(name, f) {
  if (typeof f === 'undefined') {
    // At the very least, set the message correctly
    f = function(message) {
      this.message = message;
    }
  }
  var newError = function(message) {
    var error = Error.apply(this, arguments);

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
  var value = obj[name];
  if (typeof value === 'undefined') {
    throw new TypeError(name + ' is not a valid value');
  }
  return value;
}

// Constructor for objects representing Site URLs.
export function Site(url) {
  if (!(this instanceof Site)) {
    return new Site(url);
  }
  var url_object = new URL(url);
  var host_components = url_object.hostname.split('.');
  // convert "sub2.sub1.example.com" to "['example.com', 'sub1', 'sub2']"
  this.domain_hierarchy = [host_components.slice(-2).join('.')].concat(
      host_components.slice(0, -2).reverse());
  // convert "/path/to/resource.html" to "['path', 'to', 'resource.html']"
  this.page_hierarchy = url_object.pathname.split('/').filter(
      function(x) { return Boolean(x); });
}
Site.build = function(domain_hierarchy, page_hierarchy, protocol) {
  page_hierarchy = typeof page_hierarchy !== 'undefined' ? page_hierarchy
    : [];
  protocol = typeof protocol !== 'undefined' ? protocol : 'http';
  return new Site(protocol + '://' +
                  domain_hierarchy.slice(0).reverse().join('.') + '/' +
                  page_hierarchy.join('/'))
}
Site.none = (function() {
  var none = Object.create(Site.prototype);
  none.domain_hierarchy = [];
  none.page_hierarchy = [];
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
  var DATA = '/';

  this.tree = typeof tree !== 'undefined' ? tree : {};

  // Get the closest object in the hierarchy that matches the given chain.
  this.get = function(chain) {
    var selection = this.tree;
    var last_data = this.tree[DATA];
    for (var i = 0; i < chain.length; ++i) {
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
    var selection = this.tree;
    for (var i = 0; i < chain.length; ++i) {
      if (!(chain[i] in selection)) {
        return undefined;
      }
      selection = selection[chain[i]];
    }
    return selection[DATA];
  };

  // Set a piece of data in the hierarchy
  this.set = function(chain, value) {
    var selection = this.tree;
    for (var i = 0; i < chain.length; ++i) {
      if (typeof selection[chain[i]] !== 'object') {
        selection[chain[i]] = {};
      }
      selection = selection[chain[i]];
    }
    selection[DATA] = value;
  }

  // Remove the object in the hierarchy matching the chain
  this.remove = function(chain) {
    var i = 0;
    var selection = this.tree;
    for (var i = 0; i < chain.length && typeof selection !== 'undefined';
        ++i) {
      selection = selection[chain[i]];
    }
    if (typeof selection !== 'undefined') {
      selection[DATA] = undefined;
    }
  };

  // Read a list of addresses + data into this tree
  this.load = function(tree_dump) {
    var that = this;
    tree_dump.forEach(function(entry) {
      that.set(entry.address, entry.data);
    });
  }

  // Convert a tree into a list of addresses + data
  this.dump = function() {
    return dump_tree(this.tree);
  }

  // Walk a subtree, flattening its component subtrees into a single list
  var dump_tree = function(root, address) {
    address = typeof address !== 'undefined' ? address : [];
    var list = []
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
export function Settings() {
  if (!(this instanceof Settings)) {
    return new Settings();
  }

  this.storage = new Hierarchy();

  this.save = function(site, site_settings) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    expect_type(site_settings, SiteSettings);
    var site_domain = this.storage.get_exact(site.domain_hierarchy);
    if (!(site_domain instanceof Hierarchy)) {
      site_domain = new Hierarchy();
      this.storage.set(site.domain_hierarchy, site_domain);
    }
    site_domain.set(site.page_hierarchy, site_settings);
  };

  this.remove = function(site) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    var site_domain = this.storage.get_exact(site.domain_hierarchy);
    if (!(site_domain instanceof Hierarchy)) {
      return;
    }
    site_domain.remove(site.page_hierarchy);
  };

  this.load = function(site) {
    // Coerce site to a proper Site object if it's not one already.
    site = site instanceof Site ? site : Site(site);
    var site_domain = this.storage.get(site.domain_hierarchy);
    if (site_domain instanceof Hierarchy) {
      return site_domain.get(site.page_hierarchy);
    }
    return site_domain;
  }

  // Helper function for setting the root element
  this.set_site_default = function(site_settings) {
    this.save(Site.none, site_settings);
  }
  // Helper function for getting the root element
  this.site_default = function() {
    this.load(Site.none);
  }

  // Serialize the settings in a form that can be efficiently stored with
  // chrome.storage
  this.export = function() {
    var list = [];
    this.storage.dump().forEach(function(domain_item) {
      var domain_hierarchy = domain_item.address;
      Array.prototype.push.apply(list,
        domain_item.data.dump().map(function(page_item) {
          var site = domain_hierarchy.length  === 0 ? Site.none
            : Site.build(domain_hierarchy, page_item.address);
          return { site: site, data: page_item.data };
        })
      );
    });
    return list;
  }
}
// Read the serialized settings data
Settings.import = function(settings_list) {
  var settings = new Settings();
  settings_list.forEach(function(settings_item) {
    settings.save(settings_item.site, settings_item.data);
  });
  return settings;
}

export const Filter = Object.freeze({
  deluminate: 'invert() hue-rotate(180deg) brightness(105%) contrast(105%)',
  reluminate: 'hue-rotate(180deg) brightness(95%) contrast(105%)',
  noinvert: 'none'
});

export const Modifier = Object.freeze({
  dim10: { filter: 'brightness(90%)' },
  dim20: { filter: 'brightness(80%)' },
  dim30: { filter: 'brightness(70%)' },
  dim40: { filter: 'brightness(60%)' },
  dim50: { filter: 'brightness(50%)' },
  low_contrast: { filter: 'contrast(85%)' },
  hw_accel: { rules: [ '-webkit-transform: translateZ(0)' ] }
});

export const CorrectionType = Object.freeze({
  smart: 'jpg canvas video embed object other',
  all: 'png gif jpg canvas video embed object other',
  none: '',
});

export function SiteSettings(filter, correction_mode, mods) {
  if (!(this instanceof SiteSettings)) {
    return new SiteSettings(filter, correction_mode, mods);
  }
  if (typeof filter === 'undefined') {
    throw new NotEnoughArgumentsError('filter object is required');
  }
  correction_mode = typeof correction_mode !== 'undefined' ? correction_mode
    : 'none';
  mods = typeof mods !== 'undefined' ? mods : [];
  // Just verify that the arguments represent actual things
  get(Filter, filter);
  get(CorrectionType, correction_mode);
  mods.forEach(function(mod) {
    get(Modifier, mod);
  });
  this.filter = filter;
  this.correction_mode = correction_mode;
  this.mods = mods;
}

// vim: et ts=2 sts=2 sw=2
