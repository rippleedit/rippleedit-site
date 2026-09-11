import { TRUST_PROFILES } from "./trust-data.js";

const CLIENT_QUOTES = [
  {
    name: "TB Digital",
    text: "Made my videos feel like watchin a movie… fye edits 🔥",
  },
  {
    name: "Ayo Sim",
    text: "There's nobody else I'd want to edit my footage again",
  },
  {
    name: "EbonOnTheTrack",
    text: "Always excited to get an edit back, the quality is just amazing. Gonna stay locked in with y'all 🙏",
  },
];

export const CLIENT_WORDS = CLIENT_QUOTES.map((quote) => {
  const profile = TRUST_PROFILES.find((entry) => entry.name === quote.name);

  if (!profile) {
    return quote;
  }

  return {
    ...profile,
    text: quote.text,
  };
});
