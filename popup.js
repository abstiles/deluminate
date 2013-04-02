var site;
var key1;
var key2;

function setRadio(name, value) {
  var radios = document.querySelectorAll('input[name="' + name + '"]');
  for (var i = 0; i < radios.length; i++) {
    radios[i].checked = (radios[i].value == value);
    radios[i].disabled = !getEnabled();
  }
}

function update() {
  document.body.className = getEnabled() ? '' : 'disabled';

  if (getEnabled()) {
    $('title').innerText = 'Deluminate is Enabled';
    $('toggle').innerHTML = '<b>Disable</b> ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'block';
  } else {
    $('title').innerText = 'Deluminate is Disabled';
    $('toggle').innerHTML = '<b>Enable</b> ' +
                            '<span class="kb">(' + key1 + ')</span>';
    $('subcontrols').style.display = 'none';
  }

  setRadio('keyaction', getKeyAction());
  if (site) {
    setRadio('scheme', getSiteScheme(site));
    $('make_default').disabled = (getSiteScheme(site) == getDefaultScheme());
  } else {
    setRadio('scheme', getDefaultScheme());
  }
  if (getEnabled()) {
    document.documentElement.setAttribute(
        'hc',
        site ? getSiteScheme(site) : getDefaultScheme());
  } else {
    document.documentElement.setAttribute('hc', 'normal');
  }
  chrome.extension.getBackgroundPage().updateTabs();
}

function onToggle() {
  setEnabled(!getEnabled());
  update();
}

function onForget() {
  resetSiteSchemes();
  update();
}

function onRadioChange(name, value) {
  switch (name) {
    case 'keyaction':
      setKeyAction(value);
      break;
    case 'apply':
      setApply(value);
      break;
    case 'scheme':
      if (site) {
        setSiteScheme(site, value);
      } else {
        setDefaultScheme(value);
      }
      break;
  }
  update();
}

function onMakeDefault() {
  setDefaultScheme(getSiteScheme(site));
  update();
}

function addRadioListeners(name) {
  var radios = document.querySelectorAll('input[name="' + name + '"]');
  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', function(evt) {
      onRadioChange(evt.target.name, evt.target.value);
    }, false);
    radios[i].addEventListener('click', function(evt) {
      onRadioChange(evt.target.name, evt.target.value);
    }, false);
  }
}

function init() {
  addRadioListeners('keyaction');
  addRadioListeners('apply');
  addRadioListeners('scheme');
  $('toggle').addEventListener('click', onToggle, false);
  $('make_default').addEventListener('click', onMakeDefault, false);
  $('forget').addEventListener('click', onForget, false);
  if (navigator.appVersion.indexOf('Mac') != -1) {
    key1 = '&#x2318;+Shift+F11';
    key2 = '&#x2318;+Shift+F12';
  } else {
    key1 = 'Shift+F11';
    key2 = 'Shift+F12';
  }

  chrome.windows.getLastFocused({'populate': true}, function(window) {
    for (var i = 0; i < window.tabs.length; i++) {
      var tab = window.tabs[i];
      if (tab.active) {
        if (isDisallowedUrl(tab.url)) {
          $('scheme_title').innerText = 'Default color scheme:';
          $('make_default').style.display = 'none';
        } else {
          site = siteFromUrl(tab.url);
          $('scheme_title').innerHTML = 'Color scheme for <b>' + site +
              '</b>:<br><span class="kb">(' + key2 + ')</span>';
          $('make_default').style.display = 'block';
        }
        update();
        return;
      }
    }
    site = 'unknown site';
    update();
  });
}

window.addEventListener('load', init, false);
