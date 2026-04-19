export interface User {
  id: number;
  name: string;
  role: 'admin' | 'student';
  rfid_card?: string;
}

export interface BookItem {
  id: number;
  book_id: number;
  unique_code: string;
  status: 'available' | 'borrowed';
}

export interface Book {
  id: number;
  title: string;
  author: string;
  barcode: string;
  image_url?: string;
  total_quantity: number;
  available_quantity: number;
  items?: BookItem[];
}

export interface Borrowing {
  id: number;
  student_id: number;
  book_id: number;
  borrow_date: string;
  return_date: string;
  returned: boolean;
  returned_at?: string;
  student_name?: string;
  book_title?: string;
  book_author?: string;
  book_barcode?: string;
  book_image?: string;
  item_code?: string;
}

export interface BookProposal {
  id: number;
  student_id: number;
  student_name?: string;
  title: string;
  author: string;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface SecurityLog {
  id: number;
  book_id: number | null;
  detection_time: string;
  status: string;
  book_title?: string;
  book_barcode?: string;
}
