/**
 * Sample lessons loaded by the seed script.
 *
 * These exist so the dashboard has real rows to read rather than hard-coded
 * numbers in a component. They are written to the database with
 * `isSample: true`, and every screen that shows one labels it as sample data.
 *
 * Note what is deliberately absent: no Translation rows. Each lesson carries
 * its Hindi source text and its configured language pair, which is a fact about
 * how the lesson is set up — not a claim that anything has been translated.
 * Seeding invented Santhali here would put text in front of a teacher that
 * looks like output and is not.
 */
export type SampleLesson = {
  title: string;
  subject: string;
  grade: number;
  topic: string;
  sourceText: string;
  status: "DRAFT" | "READY" | "ARCHIVED";
  isOfflinePinned: boolean;
  /** Days before seed time that the teacher last opened this lesson. */
  lastOpenedDaysAgo: number | null;
  /** Days before seed time this lesson was last edited. Staggered so the
   *  "most recently updated first" ordering is actually visible. */
  updatedDaysAgo: number;
};

export const SAMPLE_LESSONS: SampleLesson[] = [
  {
    title: "Plants",
    subject: "EVS",
    grade: 2,
    topic: "Parts of a plant",
    sourceText:
      "पौधों के मुख्य भाग जड़, तना, पत्ती, फूल और फल हैं। जड़ पौधे को मिट्टी में मजबूती से पकड़कर रखती है और पानी सोखती है।",
    status: "READY",
    isOfflinePinned: true,
    lastOpenedDaysAgo: 0,
    updatedDaysAgo: 0,
  },
  {
    title: "Counting to Twenty",
    subject: "Mathematics",
    grade: 1,
    topic: "Numbers and counting",
    sourceText:
      "आज हम एक से बीस तक गिनती सीखेंगे। पहले हम अपनी उंगलियों पर गिनेंगे, फिर कक्षा की चीज़ों को गिनेंगे।",
    status: "READY",
    isOfflinePinned: true,
    lastOpenedDaysAgo: 1,
    updatedDaysAgo: 2,
  },
  {
    title: "Our Village",
    subject: "EVS",
    grade: 3,
    topic: "Community and neighbourhood",
    sourceText:
      "हमारे गाँव में खेत, तालाब, स्कूल और पंचायत भवन हैं। गाँव के लोग मिलकर काम करते हैं और एक दूसरे की मदद करते हैं।",
    status: "READY",
    isOfflinePinned: false,
    lastOpenedDaysAgo: 3,
    updatedDaysAgo: 4,
  },
  {
    title: "Water",
    subject: "EVS",
    grade: 2,
    topic: "Sources and uses of water",
    sourceText:
      "पानी हमें नदी, तालाब, कुएँ और वर्षा से मिलता है। हमें पानी बचाना चाहिए और उसे गंदा नहीं करना चाहिए।",
    status: "DRAFT",
    isOfflinePinned: false,
    lastOpenedDaysAgo: 6,
    updatedDaysAgo: 9,
  },
  {
    title: "Animals Around Us",
    subject: "EVS",
    grade: 1,
    topic: "Domestic and wild animals",
    sourceText:
      "हमारे आसपास बहुत से जानवर रहते हैं। कुछ जानवर घर में पाले जाते हैं, जैसे गाय और बकरी। कुछ जंगल में रहते हैं।",
    status: "DRAFT",
    isOfflinePinned: false,
    lastOpenedDaysAgo: null,
    updatedDaysAgo: 13,
  },
  {
    title: "Sounds We Hear",
    subject: "Language",
    grade: 1,
    topic: "Listening and speaking",
    sourceText:
      "हमारे चारों ओर कई तरह की आवाज़ें हैं। कुछ आवाज़ें तेज़ होती हैं और कुछ धीमी। आओ, सुनकर पहचानें।",
    status: "ARCHIVED",
    isOfflinePinned: false,
    lastOpenedDaysAgo: 21,
    updatedDaysAgo: 27,
  },
];
