import { stemmer } from "stemmer";
import { distance as levenshtein } from "fastest-levenshtein";

export const relevanceScore = (title: string, queryTitle: string): number => {
	const titleWords = tokenize(title);
	const queryWords = tokenize(queryTitle);

	const titleStripped = titleWords.join("");
	const queryStripped = queryWords.join("");

	// Exact match
	if (titleStripped === queryStripped) {
		return 100;
	}

	const titlePhrase = titleWords.join(" ");
	const queryPhrase = queryWords.join(" ");

	// Exact match at beginning
	const phraseAtStartRegex = new RegExp(`^\\b${queryPhrase}\\b`, "i");
	if (phraseAtStartRegex.test(titlePhrase)) {
		return 100;
	}

	// Exact phrase match anywhere
	const phraseAnywhereRegex = new RegExp(`\\b${queryPhrase}\\b`, "i");
	if (phraseAnywhereRegex.test(titlePhrase)) {
		return 95;
	}

	// Adjacent sequence match
	const adjacentSequencePosition = getAdjacentSequencePosition(
		titleWords,
		queryWords
	);
	if (adjacentSequencePosition === 0) {
		// Adjacent sequence at beginning
		return 90;
	} else if (adjacentSequencePosition > 0) {
		// Adjacent sequence elsewhere
		return 85;
	}

	if (wordsAppearInOrder(titleWords, queryWords)) {
		return 80;
	}

	if (allWordsPresent(titleWords, queryWords)) {
		return 75;
	}

	// Partial matches
	let totalSimilarity = 0;
	for (const queryWord of queryWords) {
		let maxSimilarity = 0;
		for (const titleWord of titleWords) {
			const similarity = wordSimilarity(queryWord, titleWord);
			if (similarity > maxSimilarity) {
				maxSimilarity = similarity;
			}
		}
		totalSimilarity += maxSimilarity;
	}
	const averageSimilarity = totalSimilarity / queryWords.length;
	const finalScore = averageSimilarity * 70; // Scale to 0-70
	return Math.max(0, Math.min(70, finalScore));
};

// Get word similarity between two words
const wordSimilarity = (word1: string, word2: string): number => {
	const stemmedWord1 = stemmer(word1);
	const stemmedWord2 = stemmer(word2);

	if (stemmedWord1 === stemmedWord2) {
		return 1.0;
	}

	const maxLen = Math.max(stemmedWord1.length, stemmedWord2.length);
	const distance = levenshtein(stemmedWord1, stemmedWord2);
	const similarity = (maxLen - distance) / maxLen;

	if (similarity >= 0.6) {
		return similarity;
	}

	return 0;
};

// Sanitize and split text into tokens/words
const tokenize = (text: string): string[] => {
	return text
		.toLowerCase()
		.replace(/[\u2019']/g, "") // Remove apostrophes
		.replace(/[^\w\s]/g, "") // Remove punctuation
		.split(/\s+/) // Split into words
		.filter((word) => word.length > 0); // Remove empty strings
};

const allWordsPresent = (
	titleWords: string[],
	queryWords: string[]
): boolean => {
	for (const queryWord of queryWords) {
		let found = false;
		for (const titleWord of titleWords) {
			if (wordSimilarity(queryWord, titleWord) >= 0.7) {
				found = true;
				break;
			}
		}
		if (!found) {
			// Word not found in title
			return false;
		}
	}
	return true;
};

const wordsAppearInOrder = (
	titleWords: string[],
	queryWords: string[]
): boolean => {
	let titleIndex = 0;
	for (let i = 0; i < queryWords.length; i++) {
		const queryWord = queryWords[i];
		while (titleIndex < titleWords.length) {
			if (
				wordSimilarity(
					queryWord as string,
					titleWords[titleIndex] as string
				) >= 0.7
			) {
				// Match found
				titleIndex++;
				break;
			}
			titleIndex++;
		}
		if (titleIndex === titleWords.length && i < queryWords.length - 1) {
			// Not all words found in order
			return false;
		}
	}
	return true;
};

const getAdjacentSequencePosition = (
	titleWords: string[],
	queryWords: string[]
): number => {
	for (let i = 0; i <= titleWords.length - queryWords.length; i++) {
		let match = true;
		for (let j = 0; j < queryWords.length; j++) {
			if (
				wordSimilarity(
					queryWords[j] as string,
					titleWords[i + j] as string
				) < 0.7
			) {
				match = false;
				break;
			}
		}
		if (match) {
			return i; // Position where the adjacent sequence starts
		}
	}
	return -1; // No adjacent sequence found
};
