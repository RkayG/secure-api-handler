/**
 * Header-based API Versioning Strategy
 *
 * Handles versioning through request headers (e.g., Accept-Version: v1)
 */

import { NextRequest } from 'next/server';

export interface HeaderVersioningConfig {
  headerName?: string;
  vendorPrefix?: string;
  mediaType?: string;
  defaultVersion?: string;
  supportedVersions?: string[];
}

export class HeaderVersioningStrategy {
  private config: Required<HeaderVersioningConfig>;

  constructor(config: HeaderVersioningConfig = {}) {
    this.config = {
      headerName: config.headerName || 'Accept-Version',
      vendorPrefix: config.vendorPrefix || 'application',
      mediaType: config.mediaType || 'json',
      defaultVersion: config.defaultVersion || 'v1',
      supportedVersions: config.supportedVersions || ['v1'],
    };
  }

  /**
   * Extract version from request headers
   */
  public extractVersion(request: NextRequest): string | null {
    // Try the primary header
    const version = request.headers.get(this.config.headerName);
    if (version && this.isValidVersion(version)) {
      return version;
    }

    // Try Accept header with vendor media type
    const acceptHeader = request.headers.get('Accept');
    if (acceptHeader) {
      const vendorVersion = this.extractFromAcceptHeader(acceptHeader);
      if (vendorVersion && this.isValidVersion(vendorVersion)) {
        return vendorVersion;
      }
    }

    // Try custom headers
    const customHeaders = ['X-API-Version', 'X-Version', 'API-Version'];
    for (const header of customHeaders) {
      const version = request.headers.get(header);
      if (version && this.isValidVersion(version)) {
        return version;
      }
    }

    return null;
  }

  /**
   * Check if request has version information
   */
  public hasVersion(request: NextRequest): boolean {
    return this.extractVersion(request) !== null;
  }

  /**
   * Add version header to request (for middleware)
   */
  public addVersionToRequest(request: NextRequest, version: string): NextRequest {
    // Clone the request to avoid modifying the original
    const newHeaders = new Headers(request.headers);
    newHeaders.set(this.config.headerName, version);

    // Create a new request-like object
    const newRequest = {
      ...request,
      headers: newHeaders,
    };

    return newRequest as NextRequest;
  }

  /**
   * Generate version headers for response
   */
  public generateResponseHeaders(version: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Primary version header
    headers[this.config.headerName] = version;

    // Content-Type with version
    headers['Content-Type'] = `${this.config.vendorPrefix}/${this.config.mediaType}; version=${version}`;

    // API metadata headers
    headers['X-API-Version'] = version;
    headers['X-API-Supported-Versions'] = this.config.supportedVersions.join(', ');

    return headers;
  }

  /**
   * Generate Accept header value for a specific version
   */
  public generateAcceptHeader(version: string): string {
    return `${this.config.vendorPrefix}/${this.config.mediaType}; version=${version}`;
  }

  /**
   * Parse version from Accept header
   */
  private extractFromAcceptHeader(acceptHeader: string): string | null {
    // Handle multiple accept types separated by commas
    const acceptTypes = acceptHeader.split(',').map(type => type.trim());

    for (const acceptType of acceptTypes) {
      const version = this.extractVersionFromAcceptType(acceptType);
      if (version) {
        return version;
      }
    }

    return null;
  }

  /**
   * Extract version from a single Accept type
   */
  private extractVersionFromAcceptType(acceptType: string): string | null {
    // Match patterns like:
    // application/json; version=v1
    // application/vnd.myapp.v1+json
    // application/json;version=v1

    const patterns = [
      // Standard version parameter
      new RegExp(`${this.config.vendorPrefix}/${this.config.mediaType};\\s*version=([v\\d.]+)`, 'i'),
      // Vendor media type with version
      new RegExp(`${this.config.vendorPrefix}/vnd\\.[^.]+\\.([v\\d.]+)\\+${this.config.mediaType}`, 'i'),
      // GitHub-style vendor media type
      new RegExp(`${this.config.vendorPrefix}/vnd\\.([v\\d.]+)\\+${this.config.mediaType}`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = acceptType.match(pattern);
      if (match && match[1]) {
        return match[1].startsWith('v') ? match[1] : `v${match[1]}`;
      }
    }

    return null;
  }

  /**
   * Validate version format
   */
  public isValidVersion(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  /**
   * Add version to supported versions
   */
  public addSupportedVersion(version: string): void {
    if (!this.config.supportedVersions.includes(version)) {
      this.config.supportedVersions.push(version);
    }
  }

  /**
   * Remove version from supported versions
   */
  public removeSupportedVersion(version: string): void {
    this.config.supportedVersions = this.config.supportedVersions.filter(v => v !== version);
  }

  /**
   * Get all supported versions
   */
  public getSupportedVersions(): string[] {
    return [...this.config.supportedVersions];
  }

  /**
   * Set default version
   */
  public setDefaultVersion(version: string): void {
    if (this.isValidVersion(version)) {
      this.config.defaultVersion = version;
    } else {
      throw new Error(`Version ${version} is not supported`);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): HeaderVersioningConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HeaderVersioningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create middleware for header-based versioning
   */
  public createMiddleware() {
    return (request: NextRequest) => {
      const version = this.extractVersion(request);

      if (version) {
        // Add version to request for downstream handlers
        request.headers.set('X-API-Version', version);
        return request;
      }

      // No version found, add default
      return this.addVersionToRequest(request, this.config.defaultVersion);
    };
  }

  /**
   * Negotiate version based on client preferences
   */
  public negotiateVersion(request: NextRequest): string {
    const clientVersion = this.extractVersion(request);

    if (clientVersion && this.isValidVersion(clientVersion)) {
      return clientVersion;
    }

    return this.config.defaultVersion;
  }

  /**
   * Generate version negotiation response
   */
  public generateNegotiationResponse(supportedVersions: string[]): {
    status: number;
    headers: Record<string, string>;
    body: any;
  } {
    return {
      status: 300, // Multiple Choices
      headers: {
        'Content-Type': 'application/json',
        'X-API-Supported-Versions': supportedVersions.join(', '),
      },
      body: {
        message: 'Multiple API versions available',
        supportedVersions,
        defaultVersion: this.config.defaultVersion,
        examples: {
          header: `${this.config.headerName}: ${this.config.defaultVersion}`,
          accept: this.generateAcceptHeader(this.config.defaultVersion),
        },
      },
    };
  }
}
