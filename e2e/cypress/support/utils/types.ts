/** Shared response shapes, hand-written from the documented API contract
 *  (apps/api Swagger + the route matrix in DECISIONS.md) — not generated, so
 *  the suite does not depend on a build step to type-check. */

export type Role = 'admin' | 'user';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  isActive: boolean;
}

export interface Status extends Category {
  isDefault: boolean;
}

export interface AdminCategory extends Category {
  usageCount: number;
}

export interface AdminStatus extends Status {
  usageCount: number;
}

export interface Bootstrap {
  user: { id: string; displayName: string; avatarUrl: string | null; role: Role };
  settings: { language: 'en' | 'ar' | null; notifyOnComment: boolean; notifyOnStatusChange: boolean };
  features: { commentsEnabled: boolean; commentsRequireApproval: boolean };
  categories: Category[];
  statuses: Status[];
}

export interface RequestDto {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  statusId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  commentCount: number;
  viewerHasVoted: boolean;
  isMine: boolean;
}

export interface BoardPage {
  items: RequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VoteState {
  voteCount: number;
  viewerHasVoted: boolean;
}

export type CommentState = 'published' | 'pending';

export interface CommentDto {
  id: string;
  body: string;
  state: CommentState;
  authorName: string;
  authorAvatarUrl: string | null;
  isMine: boolean;
  createdAt: string;
}

export interface CommentPage {
  items: CommentDto[];
  nextCursor: string | null;
  total: number;
}

export type RegistrationPolicy = 'open' | 'invite_only' | 'domain_restricted';

export interface AppSettings {
  registrationPolicy: RegistrationPolicy;
  allowedEmailDomains: string[];
  commentsRequireApproval: boolean;
  featureCommentsEnabled: boolean;
  signupLimitCount: number;
  signupLimitMinutes: number;
  submissionLimitCount: number;
  submissionLimitMinutes: number;
  voteLimitCount: number;
  voteLimitMinutes: number;
}

export interface MySettings {
  language: 'en' | 'ar' | null;
  notifyOnComment: boolean;
  notifyOnStatusChange: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields?: Record<string, string>;
    retryAt?: string;
  };
}
