import { ApiProperty } from '@nestjs/swagger';
import { BootstrapData } from '../../application/use-case/read-bootstrap';

class BootstrapUser {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly displayName!: string;
  @ApiProperty({ nullable: true, type: String }) public readonly avatarUrl!: string | null;
  @ApiProperty({ enum: ['user', 'admin'] }) public readonly role!: string;
}

class BootstrapMySettings {
  @ApiProperty({ enum: ['en', 'ar'] }) public readonly language!: string;
  @ApiProperty() public readonly notifyOnComment!: boolean;
  @ApiProperty() public readonly notifyOnStatusChange!: boolean;
}

/** R-53: only what changes how the product behaves. No addresses, no secrets. */
class BootstrapFeatures {
  @ApiProperty({ description: 'R-42. When false the whole comment part disappears.' })
  public readonly commentsEnabled!: boolean;
  @ApiProperty({ description: 'R-40. New comments wait for an admin.' })
  public readonly commentsRequireApproval!: boolean;
}

/**
 * R-45: a retired row is gone from the picker but still shown correctly on the
 * old requests that use it. A request carries only a categoryId, so a screen
 * that was never told about the retired row draws a blank chip. Both lists come
 * whole, each row marked, and the picker filters on `isActive` itself — rather
 * than a second call, which is the chain H-4 exists to prevent.
 */
class BootstrapTaxonomyItem {
  @ApiProperty() public readonly id!: string;
  @ApiProperty() public readonly name!: string;
  @ApiProperty() public readonly slug!: string;
  @ApiProperty() public readonly color!: string;
  @ApiProperty({ description: 'False means retired: keep labelling it, stop offering it.' })
  public readonly isActive!: boolean;
}

class BootstrapStatusItem extends BootstrapTaxonomyItem {
  @ApiProperty() public readonly isDefault!: boolean;
}

export class BootstrapResponse {
  @ApiProperty({ type: BootstrapUser }) public readonly user!: BootstrapUser;
  @ApiProperty({ type: BootstrapMySettings }) public readonly settings!: BootstrapMySettings;
  @ApiProperty({ type: BootstrapFeatures }) public readonly features!: BootstrapFeatures;
  @ApiProperty({ type: [BootstrapTaxonomyItem] })
  public readonly categories!: BootstrapTaxonomyItem[];
  @ApiProperty({ type: [BootstrapStatusItem] }) public readonly statuses!: BootstrapStatusItem[];

  public static from(data: BootstrapData): BootstrapResponse {
    return {
      user: {
        id: data.user.id,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        role: data.user.role,
      },
      settings: {
        // Already resolved: code default, then mine (R-51).
        language: data.settings.language,
        notifyOnComment: data.settings.notifyOnComment,
        notifyOnStatusChange: data.settings.notifyOnStatusChange,
      },
      features: {
        commentsEnabled: data.appSettings.featureCommentsEnabled,
        commentsRequireApproval: data.appSettings.commentsRequireApproval,
      },
      // The admin's limits and the sign-up rule are deliberately absent: they
      // are not needed to draw the app, and R-99/R-77 say we send only what we
      // mean to. The admin screen fetches them from /v1/settings/app.
      categories: data.categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        isActive: category.isActive,
      })),
      statuses: data.statuses.map((status) => ({
        id: status.id,
        name: status.name,
        slug: status.slug,
        color: status.color,
        isActive: status.isActive,
        isDefault: status.isDefault,
      })),
    };
  }
}
