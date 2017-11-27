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

import * as path from 'path';
import {resolve as basicResolveUrl} from 'url';

import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

interface IndirectionMap {
  readonly [urlspacePath: string]: string;
}

export class IndirectUrlLoader extends UrlResolver {
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
    if (!fullPath.startsWith(this.rootPath)) {
      return path.join(this.rootPath, path.basename(fullPath)) as ResolvedUrl;
    }
    return fullPath as ResolvedUrl;
  }

  resolveFileUrl(url: FileRelativeUrl, baseUrl: ResolvedUrl): ResolvedUrl {
    const rootRelativePath = path.relative(this.rootPath, baseUrl);
    const webBaseUrl = this.filesystemToUrlspace.get(rootRelativePath);
    if (webBaseUrl === undefined) {
      throw new Error(
          `No known mapping onto url space for filesystem path: ${
                                                                  rootRelativePath
                                                                }`);
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
