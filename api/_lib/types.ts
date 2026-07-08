export interface MastData {
  orgLines: string;
  titleAccent: string;
  titleRest: string;
  period: string;
  image: string;
}

export interface EditoData {
  hello: string;
  body: string;
  signature: string;
  image: string;
}

export interface InfoBoxData {
  title: string;
  body: string;
}

export interface SummerBoxData {
  title: string;
  body: string;
  signature: string;
  image: string;
}

export interface NewsletterRow {
  id: string;
  mast: MastData;
  edito: EditoData;
  info_box: InfoBoxData;
  summer_box: SummerBoxData;
  updated_at: string;
}

export interface ArticleRow {
  id: string;
  newsletter_id: string;
  position: number;
  title: string;
  image_url: string | null;
  body: string;
  highlight: string | null;
  updated_at: string;
}

export interface ArticleVersionRow {
  id: string;
  article_id: string;
  snapshot: ArticleDTO;
  created_at: string;
}

export interface ArticleDTO {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  body: string;
  highlight: string | null;
  updatedAt: string;
}

export interface NewsletterDTO {
  id: string;
  mast: MastData;
  edito: EditoData;
  articles: ArticleDTO[];
  infoBox: InfoBoxData;
  summerBox: SummerBoxData;
}

export function articleRowToDTO(row: ArticleRow): ArticleDTO {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    imageUrl: row.image_url,
    body: row.body,
    highlight: row.highlight,
    updatedAt: row.updated_at,
  };
}

export function newsletterRowToDTO(row: NewsletterRow, articles: ArticleRow[]): NewsletterDTO {
  return {
    id: row.id,
    mast: row.mast,
    edito: row.edito,
    articles: articles.map(articleRowToDTO),
    infoBox: row.info_box,
    summerBox: row.summer_box,
  };
}
