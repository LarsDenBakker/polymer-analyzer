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

import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

export interface IndirectionMap { readonly [urlspacePath: string]: string; }

export class IndirectUrlResolver extends UrlResolver {
  private readonly urlspaceToFilesystem: ReadonlyMap<string, string>;
  private readonly filesystemToUrlspace: ReadonlyMap<string, string>;
  private readonly rootPath: string;
  private readonly packagePath: string;
  constructor(
      rootPath: string, packagePath: string, indirectionMap: IndirectionMap) {
    super();
    this.rootPath = rootPath;
    this.packagePath = packagePath;

    const urlspaceToFilesystem = new Map();
    const filesystemToUrlspace = new Map();
    for (const [url, fsPath] of Object.entries(indirectionMap)) {
      urlspaceToFilesystem.set(url, fsPath);
      filesystemToUrlspace.set(fsPath, url);
    }
    this.urlspaceToFilesystem = urlspaceToFilesystem;
    this.filesystemToUrlspace = filesystemToUrlspace;
  }

  canResolve(_url: PackageRelativeUrl|FileRelativeUrl): boolean {
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
    return rootRelativePath as ResolvedUrl;
  }

  resolveFileUrl(url: FileRelativeUrl, baseUrl: ResolvedUrl): ResolvedUrl {
    const webBaseUrl = this.filesystemToUrlspace.get(baseUrl);
    if (webBaseUrl === undefined) {
      throw new Error(
          `No known mapping onto url space for filesystem path: ` +
          `${baseUrl}`);
    }
    const webFinalPath = basicResolveUrl(webBaseUrl, url);
    const resolvedPath = this.urlspaceToFilesystem.get(webFinalPath);
    if (resolvedPath === undefined) {
      throw new Error(
          `No known mapping onto the filesystem for url: ${webFinalPath}`);
    }
    return resolvedPath as ResolvedUrl;
  }
}
