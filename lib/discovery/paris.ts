export type StoreKey = "etsy" | "amazon" | "google-play";

export type StoreOption = {
  key: StoreKey;
  label: string;
  url?: string;
};

export const parisDiscovery = {
  city: "Paris",
  product: {
    id: "paris-uncovered",
    name: "Paris Uncovered",
    totalAddresses: 25,
    stores: [
      {
        key: "etsy",
        label: "Etsy",
        url: process.env.NEXT_PUBLIC_PARIS_UNCOVERED_ETSY_URL,
      },
      {
        key: "amazon",
        label: "Amazon Kindle",
        url: process.env.NEXT_PUBLIC_PARIS_UNCOVERED_AMAZON_URL,
      },
      {
        key: "google-play",
        label: "Google Play Books",
        url: process.env.NEXT_PUBLIC_PARIS_UNCOVERED_GOOGLE_PLAY_URL,
      },
    ] satisfies StoreOption[],
  },
  miniGuideUrl: process.env.NEXT_PUBLIC_PARIS_MINI_GUIDE_URL,
  answerPages: {
    hiddenBookshops: {
      id: "paris-hidden-bookshops",
      slug: "/paris/hidden-bookshops",
      theme: "Hidden Bookshops",
      title: "Hidden Bookshops in Paris Worth Finding",
      eyebrow: "PARIS · VELVET DISCOVERY",
      answer:
        "The most memorable literary corners of Paris are rarely the largest or most advertised. They are the places you notice because the street becomes quieter, the shelves feel personal, and the visit becomes part of the city rather than another stop on a checklist.",
      featuredImage: "/images/paris-covered-passage.webp",
      discoveryTitle: "A better way to look for literary Paris",
      discoveryBody:
        "Start with atmosphere, not fame. Look around the Latin Quarter and the older streets surrounding the Sorbonne for independent bookshops, narrow passages and small interiors where the pleasure is as much in the setting as in the inventory. Velvet Passport selects places for the quality of the experience, not because they appear on every list.",
      more: [
        "Look for a place that rewards entering, not simply photographing the façade.",
        "Prefer a small cluster you can explore on foot instead of crossing Paris for a single stop.",
        "Pair the bookshop with one nearby passage, courtyard or quiet café so the discovery becomes an experience.",
      ],
    },
  },
} as const;
