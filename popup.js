var site;
var key1;
var key2;

function setRadio(name, value) {
  var radios = document.querySelectorAll('input[name="' + name + '"]');
  // Convention: trailing digits on scheme represent subschemes. Strip them
  // before looking for the correct radio to enable.
  value = value.replace(/\d+$/, '');
  for (var i = 0; i < radios.length; i++) {
    radios[i].checked = (radios[i].value.lastIndexOf(value, 0) === 0);
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
    $('toggle_contrast').checked = (getSiteModifiers(site).indexOf('low-contrast') > -1);
    $('force_textfield').checked = (getSiteModifiers(site).indexOf('force_text') > -1);
    $('kill_bgfield').checked = (getSiteModifiers(site).indexOf('kill_background') > -1);
    $('make_default').disabled = !(changedFromDefault());
  } else {
    setRadio('scheme', getDefaultScheme());
    $('toggle_contrast').checked = getLowContrast();
    $('force_textfield').checked = getForceText();
    $('kill_bgfield').checked = getKillBackground();
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

function changedFromDefault() {
  var siteModList = getSiteModifiers(site);
  var defaultModList = getDefaultModifiers();
  return (getSiteScheme(site) != getDefaultScheme() ||
          siteModList != defaultModList);
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

function onLowContrast(evt) {
  if (site) {
    if (evt.target.checked) {
      addSiteModifier(site, 'low-contrast');
    } else {
      delSiteModifier(site, 'low-contrast');
    }
  } else {
    setLowContrast(evt.target.checked);
  }
  update();
}

function onForceText(evt) {
  if (site) {
    if (evt.target.checked) {
      addSiteModifier(site, 'force_text');
    } else {
      delSiteModifier(site, 'force_text');
    }
  } else {
    setForceText(evt.target.checked);
  }
  update();
}

function onKillBackground(evt) {
  if (site) {
    if (evt.target.checked) {
      addSiteModifier(site, 'kill_background');
    } else {
      delSiteModifier(site, 'kill_background');
    }
  } else {
    setForceText(evt.target.checked);
  }
  update();
}

function onDimLevel(evt) {
  dimLevel = "noinvert-dim" + evt.target.value;
  $('dim_radio').value = dimLevel;
  if (site) {
    setSiteScheme(site, dimLevel);
  } else {
    setDefaultScheme(dimLevel);
  }
  update();
}

function onMakeDefault() {
  setDefaultScheme(getSiteScheme(site));
  setDefaultModifiers(getSiteModifiers(site));
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

// Open all links in new tabs.
function onLinkClick() {
  var links = document.getElementsByTagName("a");
  for (var i = 0; i < links.length; i++) {
      (function () {
          var ln = links[i];
          var location = ln.href;
          ln.onclick = function () {
              chrome.tabs.create({active: true, url: location});
          };
      })();
  }
}

function onSettings() {
  setSettingsViewed();
  chrome.tabs.create({active: true, url: "options.html"});
}

function init() {
  addRadioListeners('keyaction');
  addRadioListeners('apply');
  addRadioListeners('scheme');
  $('toggle_contrast').addEventListener('change', onLowContrast, false);
  $('force_textfield').addEventListener('change', onForceText, false);
  $('kill_bgfield').addEventListener('change', onKillBackground, false);
  $('dim_amount').addEventListener('input', onDimLevel, false);
  $('toggle').addEventListener('click', onToggle, false);
  $('make_default').addEventListener('click', onMakeDefault, false);
  $('settings').addEventListener('click', onSettings, false);
  if (navigator.appVersion.indexOf('Mac') != -1) {
    key1 = '&#x2318;+Shift+F11';
    key2 = '&#x2318;+Shift+F12';
  } else {
    key1 = 'Shift+F11';
    key2 = 'Shift+F12';
  }

  if (!getSettingsViewed()) {
    $('settings').className += " new";
  }

  chrome.windows.getLastFocused({'populate': true}, function(window) {
    site = '';
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
          break;
        }
      }
    }
    if (site) {
      currentScheme = getSiteScheme(site);
    } else {
      currentScheme = getDefaultScheme(site);
    }
    if (currentScheme.lastIndexOf('noinvert-dim', 0) === 0) {
      currentDimLevel = currentScheme.replace(/.*(\d+)$/, '$1');
      $('dim_amount').value = currentDimLevel;
      $('dim_radio').value = 'noinvert-dim' + currentDimLevel;
    }
    update();
  });
}

window.addEventListener('load', init, false);
document.addEventListener('DOMContentLoaded', onLinkClick);
