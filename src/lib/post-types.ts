import type { Category } from './world-machine';
export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: Category;
  tags: string[];
  demo: boolean;
  minutes: number;
}
export interface PostArticle extends PostSummary {
  html: string;
  headings: { depth: number; slug: string; text: string }[];
}
export const categoryNames: Record<Category, string> = {
  notes: '学习笔记', practice: '实践记录', reading: '阅读随想',
};
