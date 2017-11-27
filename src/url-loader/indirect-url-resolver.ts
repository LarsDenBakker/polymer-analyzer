/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {posix as path} from 'path';
import {resolve as basicResolveUrl} from 'url';

import {parseUrl} from '../core/utils';
import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

/**
 * A URL resolver for very large codebases where source files map in an
 * arbitrary but predetermined fashion onto URL space.
 *
 * It also separates the root directory – the root of all source code that's
 * legal to load – from the package directory, which is how the user refers to
 * files on the CLI or the IDE.
 */
export class IndirectUrlResolver extends UrlResolver {
  private readonly urlspaceToFilesystem: ReadonlyMap<string, string>;
  private readonly filesystemToUrlspace: ReadonlyMap<string, string>;
  private readonly rootPath: string;
  private readonly packagePath: string;

  /**
   * @param rootPath All loadable source code must be a descendent of this
   *     directory. Should be the same as FsUrlLoader.
   * @param packagePath The base directory for paths from the user. Usually the
   *     current working directory.
   * @param urlToFilesystemMap Maps the runtime URL space to the paths for those
   *     files on the filesystem. The runtime URLs should all be relative paths
   *     from the same base url. The filesystem paths should all be relative
   *     paths from `rootPath`.
   */
  constructor(
      rootPath: string, packagePath: string,
      indirectionMap: Map<string, string>) {
    super();
    this.rootPath = rootPath;
    this.packagePath = packagePath;

    const urlspaceToFilesystem = new Map();
    const filesystemToUrlspace = new Map();
    for (const [url, fsPath] of indirectionMap) {
      urlspaceToFilesystem.set(url, fsPath);
      filesystemToUrlspace.set(fsPath, url);
    }
    this.urlspaceToFilesystem = urlspaceToFilesystem;
    this.filesystemToUrlspace = filesystemToUrlspace;
  }

  canResolve(url: PackageRelativeUrl|FileRelativeUrl, _baseUrl?: ResolvedUrl):
      boolean {
    const urlObject = parseUrl(url);
    if (urlObject.host != null || urlObject.protocol != null) {
      return false;
    }
    return true;
  }

  resolve(url: PackageRelativeUrl): ResolvedUrl {
    const fullPath = path.normalize(path.join(this.packagePath, url));
    let rootRelativePath = path.relative(this.rootPath, fullPath);
    while (rootRelativePath.startsWith('../')) {
      rootRelativePath = rootRelativePath.slice(3);
    }
    while (rootRelativePath.startsWith('/')) {
      rootRelativePath = rootRelativePath.slice(1);
    }
    return this.brandAsResolved(rootRelativePath);
  }

  resolveFileUrl(url: FileRelativeUrl, baseUrl: ResolvedUrl): ResolvedUrl {
    const webBaseUrl = this.getWebPathOrDie(baseUrl);
    const webFinalPath = basicResolveUrl(webBaseUrl, url);
    return this.getFilesystemPathOrDie(webFinalPath);
  }

  getRelativePath(from: ResolvedUrl, to: ResolvedUrl): FileRelativeUrl {
    const fromWeb = this.getWebPathOrDie(from);
    const toWeb = this.getWebPathOrDie(to);
    return path.relative(path.dirname(fromWeb), toWeb) as FileRelativeUrl;
  }

  private getWebPathOrDie(fsPath: ResolvedUrl): string {
    const webUrl = this.filesystemToUrlspace.get(fsPath);
    if (webUrl === undefined) {
      throw new Error(
          `No known mapping onto url space for filesystem path: ` +
          `${fsPath}`);
    }
    return webUrl;
  }

  private getFilesystemPathOrDie(webPath: string): ResolvedUrl {
    const resolvedPath = this.urlspaceToFilesystem.get(webPath);
    if (resolvedPath === undefined) {
      throw new Error(
          `No known mapping onto the filesystem for url: ${webPath}`);
    }
    return this.brandAsResolved(resolvedPath);
  }
}
