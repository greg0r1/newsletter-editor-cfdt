/**
 * Tests du sanitizer maison. `sanitizeHtml` est la seule barrière serveur
 * contre le XSS stocké : elle a déjà eu deux bugs de prod (crash ESM, puis
 * sur-échappement des entités), donc on la couvre par une batterie de cas
 * adverses + une garantie d'idempotence.
 *
 * Sans dépendance : runner intégré de Node.
 * Usage: npm test   (→ node --import tsx --test api/_lib/sanitize.test.ts)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, sanitizeHtml } from './sanitize.js';

test('conserve les balises et attributs autorisés', () => {
  const input = '<p>Bonjour <strong>tout le monde</strong></p>';
  assert.equal(sanitizeHtml(input), input);
});

test('conserve <sup> (ex. 51e Congrès)', () => {
  const input = '51<sup>e</sup> Congrès';
  assert.equal(sanitizeHtml(input), input);
});

test('retire une balise non autorisée mais garde son contenu texte', () => {
  assert.equal(sanitizeHtml('<div>coucou</div>'), 'coucou');
});

test('retire un bloc <script> correctement fermé, contenu compris', () => {
  const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
  assert.equal(out, '<p>ok</p>');
});

test('retire un bloc <script> NON fermé jusqu\'à la fin (paste tronqué)', () => {
  const out = sanitizeHtml('<p>ok</p><script>document.cookie');
  assert.equal(out, '<p>ok</p>');
  assert.ok(!out.includes('document.cookie'));
});

test('un bloc clos ne mange pas le contenu légitime qui le suit', () => {
  const out = sanitizeHtml('<script>a</script><p>legit</p>');
  assert.equal(out, '<p>legit</p>');
});

test('href autorisé (https/mailto) conservé, javascript: rejeté', () => {
  assert.ok(sanitizeHtml('<a href="https://cfdt.fr">x</a>').includes('href="https://cfdt.fr"'));
  assert.ok(sanitizeHtml('<a href="mailto:a@b.fr">x</a>').includes('href="mailto:a@b.fr"'));
  assert.ok(!sanitizeHtml('<a href="javascript:alert(1)">x</a>').includes('javascript'));
});

test('style: seule la couleur hex est conservée', () => {
  assert.ok(sanitizeHtml('<span style="color:#ff0000">x</span>').includes('style="color:#ff0000"'));
  assert.ok(!sanitizeHtml('<span style="position:fixed">x</span>').includes('position'));
});

test('XSS : un href piégé avec entités ne peut pas s\'évader de l\'attribut', () => {
  const payload = '<a href="https://x.com/&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">click</a>';
  const out = sanitizeHtml(payload);
  // Aucune vraie balise <img> ne doit apparaître : les `<`/`>` décodés doivent
  // être ré-échappés à l'intérieur de la valeur d'attribut.
  assert.ok(!out.includes('<img'), `évasion d'attribut détectée: ${out}`);
  assert.ok(out.includes('&lt;img'), `les <> auraient dû être ré-échappés: ${out}`);
});

test('&nbsp; est normalisé en espace insécable U+00A0 (pas de collapse au rendu)', () => {
  assert.equal(sanitizeHtml('a&nbsp;b'), 'a b');
});

test('idempotence : sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x)', () => {
  const cases = [
    '<p>a&nbsp;b</p>',
    'Tom &amp; Jerry',
    'utilisez &lt;strong&gt; pour le gras',
    '<a href="https://x.fr">lien</a>',
    '<ul><li>un</li><li>deux</li></ul>',
    '51<sup>e</sup> Congrès&nbsp;: bilan',
  ];
  for (const c of cases) {
    const once = sanitizeHtml(c);
    const twice = sanitizeHtml(once);
    assert.equal(twice, once, `non idempotent pour: ${c}`);
  }
});

test('decodeEntities effondre une seule couche &amp; par passe', () => {
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
  assert.equal(decodeEntities('&lt;'), '<');
});
