/**
 * Feature Flags System
 *
 * Manages feature toggles with support for A/B testing,
 * gradual rollouts, and user segmentation
 */

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  userSegments?: string[];
  conditions?: FeatureCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureCondition {
  type: 'user' | 'tenant' | 'environment' | 'time' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  field?: string;
}

export interface UserContext {
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  attributes?: Record<string, any>;
}

export class FeatureFlags {
  private static instance: FeatureFlags;
  private flags: Map<string, FeatureFlag> = new Map();
  private userOverrides: Map<string, Map<string, boolean>> = new Map();

  private constructor() {
    this.initializeDefaultFlags();
  }

  public static getInstance(): FeatureFlags {
    if (!FeatureFlags.instance) {
      FeatureFlags.instance = new FeatureFlags();
    }
    return FeatureFlags.instance;
  }

  /**
   * Check if feature is enabled for user/context
   */
  public isEnabled(feature: string, context?: UserContext): boolean {
    const flag = this.flags.get(feature);
    if (!flag) return false;

    // Check user-specific overrides
    if (context?.id) {
      const userOverrides = this.userOverrides.get(context.id);
      if (userOverrides?.has(feature)) {
        return userOverrides.get(feature)!;
      }
    }

    // Check conditions
    if (flag.conditions && flag.conditions.length > 0) {
      return this.evaluateConditions(flag.conditions, context);
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      return this.isInRollout(flag.rolloutPercentage, context);
    }

    return flag.enabled;
  }

  /**
   * Enable feature globally
   */
  public enable(feature: string): void {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.enabled = true;
    } else {
      this.flags.set(feature, {
        name: feature,
        enabled: true,
        description: `Auto-created feature flag: ${feature}`,
      });
    }
  }

  /**
   * Disable feature globally
   */
  public disable(feature: string): void {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.enabled = false;
    }
  }

  /**
   * Set feature flag with configuration
   */
  public setFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, { ...flag });
  }

  /**
   * Override feature for specific user
   */
  public overrideForUser(feature: string, userId: string, enabled: boolean): void {
    if (!this.userOverrides.has(userId)) {
      this.userOverrides.set(userId, new Map());
    }
    this.userOverrides.get(userId)!.set(feature, enabled);
  }

  /**
   * Remove user override
   */
  public removeUserOverride(feature: string, userId: string): void {
    const userOverrides = this.userOverrides.get(userId);
    if (userOverrides) {
      userOverrides.delete(feature);
      if (userOverrides.size === 0) {
        this.userOverrides.delete(userId);
      }
    }
  }

  /**
   * Get all feature flags
   */
  public getAllFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [name, flag] of this.flags.entries()) {
      result[name] = flag.enabled;
    }
    return result;
  }

  /**
   * Get feature flag details
   */
  public getFlag(feature: string): FeatureFlag | null {
    return this.flags.get(feature) || null;
  }

  /**
   * Get all flags with details
   */
  public getAllFlagsDetailed(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Load flags from configuration
   */
  public loadFromConfig(config: Record<string, any>): void {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'boolean') {
        this.setFlag({
          name: key,
          enabled: value,
          description: `Loaded from config: ${key}`,
        });
      } else if (typeof value === 'object' && value !== null) {
        const flagConfig = value as Partial<FeatureFlag>;
        this.setFlag({
          name: key,
          enabled: flagConfig.enabled || false,
          description: flagConfig.description,
          rolloutPercentage: flagConfig.rolloutPercentage,
          userSegments: flagConfig.userSegments,
          conditions: flagConfig.conditions,
          metadata: flagConfig.metadata,
        });
      }
    }
  }

  /**
   * Set rollout percentage for gradual feature rollout
   */
  public setRolloutPercentage(feature: string, percentage: number): void {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    }
  }

  /**
   * Add user segments for feature targeting
   */
  public setUserSegments(feature: string, segments: string[]): void {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.userSegments = segments;
    }
  }

  /**
   * Add conditions for feature evaluation
   */
  public setConditions(feature: string, conditions: FeatureCondition[]): void {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.conditions = conditions;
    }
  }

  /**
   * Evaluate conditions for feature access
   */
  private evaluateConditions(conditions: FeatureCondition[], context?: UserContext): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: FeatureCondition, context?: UserContext): boolean {
    const { type, operator, value, field } = condition;

    let actualValue: any;

    switch (type) {
      case 'user':
        actualValue = field ? context?.attributes?.[field] : context?.id;
        break;
      case 'tenant':
        actualValue = context?.tenantId;
        break;
      case 'environment':
        actualValue = process.env.NODE_ENV;
        break;
      case 'time':
        actualValue = Date.now();
        break;
      case 'custom':
        actualValue = context?.attributes?.[field || 'custom'];
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, operator, value);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'in':
        return Array.isArray(expected) ? expected.includes(actual) : false;
      case 'not_in':
        return Array.isArray(expected) ? !expected.includes(actual) : true;
      default:
        return false;
    }
  }

  /**
   * Check if user is in rollout percentage
   */
  private isInRollout(percentage: number, context?: UserContext): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    // Use user ID or random number for rollout decision
    const seed = context?.id ? this.hashString(context.id) : Math.random();
    const normalizedSeed = (seed % 100) / 100;

    return normalizedSeed < (percentage / 100);
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        name: 'authentication',
        enabled: true,
        description: 'Enable user authentication',
      },
      {
        name: 'rate-limiting',
        enabled: true,
        description: 'Enable rate limiting',
      },
      {
        name: 'caching',
        enabled: true,
        description: 'Enable response caching',
      },
      {
        name: 'encryption',
        enabled: true,
        description: 'Enable data encryption',
      },
      {
        name: 'sanitization',
        enabled: true,
        description: 'Enable input sanitization',
      },
      {
        name: 'monitoring',
        enabled: true,
        description: 'Enable monitoring and metrics',
      },
      {
        name: 'multitenancy',
        enabled: false,
        description: 'Enable multi-tenant features',
      },
      {
        name: 'api-versioning',
        enabled: true,
        description: 'Enable API versioning',
      },
    ];

    for (const flag of defaultFlags) {
      this.flags.set(flag.name, flag);
    }
  }

  /**
   * Get feature usage statistics
   */
  public getStats(): {
    totalFlags: number;
    enabledFlags: number;
    userOverrides: number;
    flagsWithConditions: number;
    flagsWithRollout: number;
  } {
    let enabledFlags = 0;
    let flagsWithConditions = 0;
    let flagsWithRollout = 0;

    for (const flag of this.flags.values()) {
      if (flag.enabled) enabledFlags++;
      if (flag.conditions && flag.conditions.length > 0) flagsWithConditions++;
      if (flag.rolloutPercentage !== undefined) flagsWithRollout++;
    }

    return {
      totalFlags: this.flags.size,
      enabledFlags,
      userOverrides: this.userOverrides.size,
      flagsWithConditions,
      flagsWithRollout,
    };
  }

  /**
   * Clean up old user overrides (for memory management)
   */
  public cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    // Remove user overrides older than maxAge
    // This is a simple implementation - in production, you'd want timestamps
    let cleaned = 0;

    // For now, just remove empty override maps
    for (const [userId, overrides] of this.userOverrides.entries()) {
      if (overrides.size === 0) {
        this.userOverrides.delete(userId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
