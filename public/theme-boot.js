(function () {
  // Ce script doit rester un fichier JS classique non-module (exécution
  // synchrone avant tout paint, voir index.html/config/index.html) : il ne
  // peut donc pas `import` de constante partagée. Les clés localStorage et la
  // valeur par défaut ci-dessous sont dupliquées à l'identique dans
  // config/main.ts (THEME_KEY/SCHEME_KEY/DEFAULT_THEME) — les garder
  // synchronisées si l'une des deux change.
  function applyStoredTheme() {
    document.documentElement.dataset.theme = localStorage.getItem('cfdt-editor-theme') || 'orange';
    var stored = localStorage.getItem('cfdt-editor-color-scheme');
    document.documentElement.dataset.colorScheme =
      stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  applyStoredTheme();
  // Une page restaurée depuis le bfcache (retour arrière du navigateur) ne
  // réexécute pas ce script : sans ce hook, un changement de thème fait sur
  // /config/ pendant la session n'apparaîtrait pas au retour arrière.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) applyStoredTheme();
  });
})();
