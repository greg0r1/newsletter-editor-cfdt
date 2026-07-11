export interface Mast {
  orgLines: string;
  titleAccent: string;
  titleRest: string;
  period: string;
  image: string;
}

export interface Edito {
  hello: string;
  body: string;
  signature: string;
  image: string;
}

export interface Article {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  body: string;
  highlight: string | null;
  updatedAt: string;
}

export interface InfoBox {
  title: string;
  body: string;
}

export interface SummerBox {
  title: string;
  body: string;
  signature: string;
  image: string;
}

export interface Newsletter {
  id: string;
  mast: Mast;
  edito: Edito;
  articles: Article[];
  infoBox: InfoBox;
  summerBox: SummerBox;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  snapshot: Article;
  createdAt: string;
}

export interface BlobImage {
  url: string;
  uploadedAt: string;
  size: number;
}
