export interface MastData {
  title: string;
  titleMode: 'text' | 'image';
  titleImageUrl: string | null;
  period: string;
  image: string;
  footerLogoUrl: string;
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
  layout: string;
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
  layout: 'full' | 'half';
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

// Coercion défensive : `layout` vient soit d'une colonne Postgres (ArticleRow,
// typée `string`), soit d'un snapshot JSONB historique (ArticleVersionRow,
// typé ArticleDTO côté TS mais dont la vraie forme au runtime n'est pas
// garantie — colonne ajoutée après coup, absente des anciens snapshots).
// Dans les deux cas, toute valeur autre que 'half' retombe sur 'full'.
export function normalizeLayout(value: unknown): 'full' | 'half' {
  return value === 'half' ? 'half' : 'full';
}

export function articleRowToDTO(row: ArticleRow): ArticleDTO {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    imageUrl: row.image_url,
    body: row.body,
    highlight: row.highlight,
    layout: normalizeLayout(row.layout),
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

export interface AppSettingsRow {
  id: boolean;
  logo_url: string;
  app_title: string;
  updated_at: string;
}

export interface AppSettingsDTO {
  logoUrl: string;
  appTitle: string;
}

export function appSettingsRowToDTO(row: AppSettingsRow): AppSettingsDTO {
  return { logoUrl: row.logo_url, appTitle: row.app_title };
}
