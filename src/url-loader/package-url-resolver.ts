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
import * as pathlib from 'path';
import {posix as posix} from 'path';
import {Url} from 'url';
import Uri from 'vscode-uri';

import {parseUrl} from '../core/utils';
import {FileRelativeUrl, ScannedImport} from '../index';
import {ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

export interface PackageUrlResolverOptions {
  packageDir?: string;
  componentDir?: string;
  hostname?: string;
}

const isWindows = process.platform === 'win32';

/**
 * Resolves a URL to a canonical URL within a package.
 */
export class PackageUrlResolver extends UrlResolver {
  private readonly packageDir: string;
  private readonly packageUrl: ResolvedUrl;
  readonly componentDir: string;
  readonly hostname: string|null;
  private readonly resolvedComponentDir: string;

  constructor(options?: PackageUrlResolverOptions) {
    super();
    options = options || {};
    const packageDir = options.packageDir || process.cwd();
    this.packageDir = pathlib.resolve(packageDir);
    this.packageUrl =
        this.brandAsResolved(Uri.file(this.packageDir).toString());
    if (!this.packageUrl.endsWith('/')) {
      this.packageUrl = this.brandAsResolved(this.packageUrl + '/');
    }
    this.componentDir = options.componentDir || 'bower_components/';
    this.hostname = options.hostname || null;
    this.resolvedComponentDir =
        pathlib.join(this.packageDir, this.componentDir);
  }

  resolve(
      unresolvedHref: FileRelativeUrl, baseUrl: ResolvedUrl = this.packageUrl,
      _import?: ScannedImport): ResolvedUrl|undefined {
    const resolvedHref = this.simpleUrlResolve(unresolvedHref, baseUrl);
    if (resolvedHref === undefined) {
      return undefined;
    }
    const url = parseUrl(resolvedHref);
    if (this.shouldHandleAsFileUrl(url)) {
      return this.handleFileUrl(url, unresolvedHref);
    }
    return this.brandAsResolved(resolvedHref);
  }

  private shouldHandleAsFileUrl(url: Url) {
    const isLocalFileUrl =
        url.protocol === 'file:' && (!url.host || url.host === 'localhost');
    const isOurHostname = url.hostname === this.hostname;
    return isLocalFileUrl || isOurHostname;
  }

  private handleFileUrl(url: Url, unresolvedHref: string) {
    let pathname: string;
    const unresolvedUrl = parseUrl(unresolvedHref);
    if (unresolvedUrl.pathname && unresolvedUrl.pathname.startsWith('/') &&
        unresolvedUrl.protocol !== 'file:') {
      // Absolute urls point to the package root.
      let unresolvedPathname: string;
      try {
        unresolvedPathname =
            posix.normalize(decodeURIComponent(unresolvedUrl.pathname));
      } catch (e) {
        return undefined;
      }
      pathname = pathlib.join(this.packageDir, unresolvedPathname);
    } else {
      try {
        pathname = posix.normalize(decodeURIComponent(url.pathname || ''));
      } catch (e) {
        return undefined;  // undecodable url
      }
    }

    // If the path points to a sibling directory, resolve it to the
    // component directory
    const parentOfPackageDir = pathlib.dirname(this.packageDir);
    let path = this.filesystemPathForPathname(pathname);
    if (path.startsWith(parentOfPackageDir) &&
        !path.startsWith(this.packageDir)) {
      path = pathlib.join(
          this.packageDir,
          this.componentDir,
          path.substring(parentOfPackageDir.length));
    }

    // Re-encode URI, since it is expected we are emitting a relative URL.
    return this.brandAsResolved(Uri.file(path).toString());
  }

  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, _kind?: string):
      FileRelativeUrl {
    let from, to;
    if (maybeTo !== undefined) {
      from = fromOrTo;
      to = maybeTo;
    } else {
      from = this.packageUrl;
      to = fromOrTo;
    }
    return this.relativeImpl(from, to);
  }

  private relativeImpl(from: ResolvedUrl, to: ResolvedUrl): FileRelativeUrl {
    const pathnameInComponentDir = this.pathnameForComponentDirUrl(to);
    if (pathnameInComponentDir !== undefined) {
      if (this.pathnameForComponentDirUrl(from) === undefined) {
        const componentDirPath =
            pathnameInComponentDir.slice(this.resolvedComponentDir.length);
        const reresolved = this.simpleUrlResolve(
            ('../' + componentDirPath) as FileRelativeUrl, this.packageUrl);
        if (reresolved !== undefined) {
          to = reresolved;
        }
      }
    }

    return this.simpleUrlRelative(from, to);
  }

  /**
   * If the given URL is a file url inside our dependencies (e.g.
   * bower_components) then return a resolved posix path to its file.
   * Otherwise return undefined.
   */
  private pathnameForComponentDirUrl(resolvedUrl: ResolvedUrl): string
      |undefined {
    const url = parseUrl(resolvedUrl);
    if (this.shouldHandleAsFileUrl(url) && url.pathname) {
      let pathname;
      try {
        pathname = posix.normalize(decodeURIComponent(url.pathname));
      } catch {
        return undefined;
      }
      const path = this.filesystemPathForPathname(pathname);
      if (path && path.startsWith(this.resolvedComponentDir)) {
        return path;
      }
    }
    return undefined;
  }

  private filesystemPathForPathname(decodedPathname: string) {
    let path = Uri.file(decodedPathname).fsPath;
    if (isWindows && /^[a-z]:/.test(path)) {
      // Upper case the drive letter
      path = path[0].toUpperCase() + path.slice(1);
    }
    return path;
  }
}
