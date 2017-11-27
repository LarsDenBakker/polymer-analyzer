/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';

import {Analyzer} from '../../core/analyzer';
import {IndirectUrlResolver} from '../../url-loader/indirect-url-resolver';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';

suite('IndirectUrlResolver', function() {

  test('the thing', async() => {
    const overlayLoader = new InMemoryOverlayUrlLoader();
    const mapping = {
      '/components/foo/foo.html': 'sub/package/foo/foo.html',
      '/components/foo/foo.css': 'sub/package/foo/foo.css',
      '/components/bar/bar.html': 'different/x/y/bar.html',
      '/components/bar/bar.css': 'different/x/y/bar.css',
    };
    overlayLoader.urlContentsMap.set('sub/package/foo/foo.html', `
      <link rel="import" href="../bar/bar.html">
      <link rel="stylesheet" href="foo.css">
    `);
    overlayLoader.urlContentsMap.set('sub/package/foo/foo.css', ``);
    overlayLoader.urlContentsMap.set('different/x/y/bar.html', `
      <link rel="stylesheet" href="./bar.css">
    `);
    overlayLoader.urlContentsMap.set('different/x/y/bar.css', ``);
    const indirectResolver =
        new IndirectUrlResolver('/root', '/root/sub/package', mapping);
    const analyzer =
        new Analyzer({urlLoader: overlayLoader, urlResolver: indirectResolver});
    const analysis = await analyzer.analyze(['foo/foo.html']);
    assert.deepEqual(
        analysis.getWarnings().map((w) => w.toString({verbosity: 'code-only'})),
        []);
    const documents = analysis.getFeatures({kind: 'document'});
    assert.deepEqual([...documents].map((d) => d.url), [
      'sub/package/foo/foo.html',
      'different/x/y/bar.html',
      'different/x/y/bar.css',
      'sub/package/foo/foo.css'
    ]);
  });

});
