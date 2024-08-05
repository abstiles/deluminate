import {Site} from './utils.js';

export function UrlSelector(url_string) {
  // Needed to reference 'this' when concatenating arrays.
  var self = this;
  if (!(this instanceof UrlSelector)) {
    return new UrlSelector(url_string);
  }
  var site = new Site(url_string);
  this.subdomains = site.domain_hierarchy.slice(1).reverse();
  this.domain = site.domain_hierarchy[0];
  this.path_parts = site.page_hierarchy.slice(0);
  this.pieces = [];
  Array.prototype.push.apply(this.pieces, this.subdomains.map(function(sub) {
    return self.url_component(sub);
  }));
  var domain_piece = this.url_component(this.domain);
  domain_piece.id = 'domain';
  domain_piece.classList.add('end');
  this.pieces.push(domain_piece);
  this.pieces[0].classList.add('start');
  Array.prototype.push.apply(this.pieces, this.path_parts.map(function(path) {
    return self.url_component(path, false);
  }));
}
UrlSelector.prototype.render_to = function(target) {
  // Set the appropriate class for CSS rendering
  if (!target.classList.contains('url_selector')) {
    target.classList.add('url_selector');
  }
  // Clear any existing contents. Hope you didn't want it!
  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }
  this.pieces.forEach(function(piece) {
    target.appendChild(piece);
  });
}
UrlSelector.prototype.clear_start = function() {
  this.clear_class_from_children('start');
}
UrlSelector.prototype.clear_end = function() {
  this.clear_class_from_children('end');
}
UrlSelector.prototype.clear_class_from_children = function(class_name) {
  this.pieces.forEach(function(piece) {
      piece.classList.remove(class_name);
  });
}
UrlSelector.prototype.clear_path = function() {
  this.clear_end();
  document.getElementById('domain').classList.add('end');
}
UrlSelector.prototype.reset_default = function() {
  this.clear_path();
  this.clear_start();
  this.pieces[0].classList.add('start');
}
UrlSelector.prototype.url_component = function(text, is_host) {
  // Needed to reference 'this' in the onclick callback
  var self = this;
  is_host = typeof is_host !== 'undefined' ? is_host : true;
  var new_element = document.createElement('span');
  new_element.textContent = text;
  new_element.onclick = (function(evt) {
    var target = evt.target;
    if (is_host) {
      self.clear_start();
      self.clear_path();
      target.classList.add('start');
    } else {
      self.clear_end();
      target.classList.add('end');
    }
  });
  new_element.classList.add(is_host ? 'host' : 'path');
  return new_element;
}
UrlSelector.prototype.select_host = function(name) {
  var self = this;
  this.pieces.filter(is_host_element).forEach(function(elem) {
    if (elem.textContent.match(name)) {
      self.select_item(elem);
    }
  });
}
UrlSelector.prototype.select_path = function(name) {
  var self = this;
  this.pieces.filter(is_path_element).forEach(function(elem) {
    if (elem.textContent.match(name)) {
      self.select_item(elem);
    }
  });
}
UrlSelector.prototype.select_item = function(elem) {
  elem.click();
}
UrlSelector.prototype.get_site = function() {
  var selected = false;
  var domains = [];
  var paths = [];
  this.pieces.forEach(function(piece) {
    if (piece.classList.contains('start')) {
      selected = true;
    }
    if (selected && piece.classList.contains('host')) {
      domains.push(piece.textContent);
    } else if (selected) {
      paths.push(piece.textContent);
    }
    if (piece.classList.contains('end')) {
      selected = false;
    }
  });
  domains.reverse();
  return new Site.build(domains, paths);
}
UrlSelector.prototype.select_site = function(site) {
  // Just use the default if the site doesn't actually match. Don't treat
  // this as an error because it's more convenient to treat the default case
  // as an instance of this.
  if (site.domain_hierarchy[0] != this.domain) {
    this.reset_default();
    return;
  }
  var hosts = site.domain_hierarchy.slice(1);
  var paths = site.page_hierarchy.slice(0);
  var idx = 0;
  // Use the default full-domain selection if all domain components are the
  // same
  this.subdomains.slice(0).reverse().every(function(sub) {
    if (hosts[idx] != sub) {
      return false;
    }
    idx++;
    return true;
  });
  // Select the matching component of the domain
  this.select_item(this.pieces[this.subdomains.length - idx]);
  idx = 0;
  // Find the first path component that's not the same
  this.path_parts.every(function(path) {
    if (paths[idx] != path) {
      return false;
    }
    idx++;
    return true;
  });
  // Don't use the default if any common paths were found
  if (idx > 0) {
    // Select the matching component of the path
    this.select_item(this.pieces[this.subdomains.length + idx]);
  }
}

function is_host_element(elem) {
  return elem.classList.contains('host');
}

function is_path_element(elem) {
  return elem.classList.contains('path');
}

export default UrlSelector;

// vim: et ts=2 sts=2 sw=2
