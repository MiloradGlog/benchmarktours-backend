// TypeScript types for Shopping List feature

export interface ShoppingItem {
  id: number;
  tour_id: number;
  created_by: string; // UUID
  text: string;
  value?: string;
  company_id?: number;
  company_note?: string;
  created_at: Date;
  updated_at: Date;
  // Populated fields
  creator_name?: string;
  company_name?: string;
  upvotes?: number;
  downvotes?: number;
  user_vote?: 'upvote' | 'downvote' | null;
  comment_count?: number;
  images?: string[];
}

export interface ShoppingItemVote {
  id: number;
  item_id: number;
  user_id: string; // UUID
  vote_type: 'upvote' | 'downvote';
  created_at: Date;
}

export interface ShoppingItemComment {
  id: number;
  item_id: number;
  user_id: string; // UUID
  text: string;
  created_at: Date;
  // Populated fields
  user_first_name?: string;
  user_last_name?: string;
  user_name?: string;
}

export interface ShoppingItemImage {
  id: number;
  item_id: number;
  image_url: string;
  created_at: Date;
}

// Request/Response types
export interface CreateShoppingItemData {
  text: string;
  value?: string;
  company_id?: number;
  company_note?: string;
  images?: string[];
}

export interface UpdateShoppingItemData {
  text?: string;
  value?: string;
  company_id?: number;
  company_note?: string;
  images?: string[];
}

export interface VoteData {
  vote_type: 'upvote' | 'downvote';
}

export interface CreateCommentData {
  text: string;
}

export interface ShoppingListResponse {
  items: ShoppingItem[];
  total_count: number;
}

export interface ShoppingItemDetail extends ShoppingItem {
  comments: ShoppingItemComment[];
}