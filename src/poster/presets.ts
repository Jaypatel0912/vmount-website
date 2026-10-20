import type { DesignId } from "./draw";

/** Ready-made festivals for the poster page. Everything stays editable. */
export type Preset = {
  id: string;
  name: string;
  greeting: string;
  greetingLocal: string;
  headline: string;
  subline: string;
  design: DesignId;
  /** Used for greeting posters (no offer). */
  wishHeadline: string;
  wishMessage: string;
};

export const PRESETS: Preset[] = [
  { id: "diwali", name: "Diwali", greeting: "Happy Diwali", greetingLocal: "શુભ દીપાવલી", headline: "Diwali Dhamaka Offer", subline: "Light up the festival with a brand-new VMount cycle", design: "royal", wishHeadline: "Happy Diwali", wishMessage: "May this festival of lights fill your home with joy, good health and many happy rides. Warm wishes from all of us at V Mount Bikes." },
  { id: "dhanteras", name: "Dhanteras", greeting: "Happy Dhanteras", greetingLocal: "શુભ ધનતેરસ", headline: "Dhanteras Special", subline: "Bring home a new VMount cycle on this auspicious day", design: "royal", wishHeadline: "Happy Dhanteras", wishMessage: "Wishing you prosperity, good health and many happy journeys this Dhanteras." },
  { id: "new-year", name: "Gujarati New Year", greeting: "Saal Mubarak", greetingLocal: "નૂતન વર્ષાભિનંદન", headline: "New Year, New Ride", subline: "Start the new year on a brand-new VMount cycle", design: "sunrise", wishHeadline: "Saal Mubarak", wishMessage: "Wishing you and your family a joyful, prosperous new year full of happy rides." },
  { id: "navratri", name: "Navratri", greeting: "Happy Navratri", greetingLocal: "શુભ નવરાત્રી", headline: "Navratri Utsav Offer", subline: "Nine nights of festive savings on VMount cycles", design: "sunrise", wishHeadline: "Happy Navratri", wishMessage: "May Maa Amba bless you with strength, joy and happiness this Navratri." },
  { id: "uttarayan", name: "Uttarayan", greeting: "Happy Uttarayan", greetingLocal: "ઉત્તરાયણની શુભકામનાઓ", headline: "Uttarayan Offer", subline: "Fly high this kite festival with a new VMount cycle", design: "sunrise", wishHeadline: "Happy Uttarayan", wishMessage: "May your kites and your spirits fly high this Uttarayan!" },
  { id: "holi", name: "Holi", greeting: "Happy Holi", greetingLocal: "હોળીની શુભકામનાઓ", headline: "Holi Colours Sale", subline: "Add colour to your rides with festive prices", design: "sunrise", wishHeadline: "Happy Holi", wishMessage: "Wishing you a Holi full of colour, fun and happy rides." },
  { id: "raksha-bandhan", name: "Raksha Bandhan", greeting: "Happy Raksha Bandhan", greetingLocal: "રક્ષાબંધનની શુભકામનાઓ", headline: "Raksha Bandhan Gift Offer", subline: "The perfect gift for your brother or sister", design: "sunrise", wishHeadline: "Happy Raksha Bandhan", wishMessage: "Celebrating the beautiful bond between brothers and sisters." },
  { id: "independence-day", name: "Independence Day", greeting: "Happy Independence Day", greetingLocal: "સ્વતંત્રતા દિવસની શુભકામનાઓ", headline: "Freedom Ride Sale", subline: "Celebrate freedom on two wheels", design: "brand", wishHeadline: "Happy Independence Day", wishMessage: "Saluting the spirit of freedom. Jai Hind!" },
  { id: "janmashtami", name: "Janmashtami", greeting: "Happy Janmashtami", greetingLocal: "જન્માષ્ટમીની શુભકામનાઓ", headline: "Janmashtami Special", subline: "Festive prices on VMount cycles", design: "midnight", wishHeadline: "Happy Janmashtami", wishMessage: "May Lord Krishna bless you with joy, love and happiness." },
  { id: "ganesh-chaturthi", name: "Ganesh Chaturthi", greeting: "Ganpati Bappa Morya", greetingLocal: "ગણેશ ચતુર્થીની શુભકામનાઓ", headline: "Ganesh Utsav Offer", subline: "A fresh start with a new VMount cycle", design: "sunrise", wishHeadline: "Ganpati Bappa Morya", wishMessage: "May Lord Ganesha remove every obstacle from your path." },
  { id: "christmas", name: "Christmas", greeting: "Merry Christmas", greetingLocal: "", headline: "Christmas Cycle Sale", subline: "Gift a ride this Christmas", design: "midnight", wishHeadline: "Merry Christmas", wishMessage: "Wishing you peace, joy and happy rides this Christmas." },
  { id: "new-year-eve", name: "New Year", greeting: "Happy New Year", greetingLocal: "", headline: "New Year Mega Sale", subline: "Ride into the new year with VMount", design: "midnight", wishHeadline: "Happy New Year", wishMessage: "Here is to a year of new journeys and happy rides!" },
  { id: "custom", name: "Other / custom", greeting: "", greetingLocal: "", headline: "", subline: "", design: "brand", wishHeadline: "", wishMessage: "" },
];
