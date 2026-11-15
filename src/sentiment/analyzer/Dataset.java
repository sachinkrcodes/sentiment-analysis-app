package sentiment.analyzer;

import sentiment.util.Csv;

import java.util.*;

/**
 * Labelled examples read from a CSV file.
 * Columns: a header named text / review / comment / sentence / content / tweet / post and one named
 * label / sentiment / class / target / polarity is used when present, else the first column is the text
 * and the last column is the label.
 * Labels can be words (positive / neutral / negative) or numbers: 0/1 (negative/positive),
 * -1/0/1, 0/1/2 (negative/neutral/positive), 0/2/4, or star ratings 1 to 5.
 * Exact duplicate texts are removed, and a text that appears with two different labels is dropped,
 * so the same sentence can never sit in both the training and the test part.
 */
public final class Dataset {
    private static final Set<String> TEXT_NAMES = new HashSet<>(Arrays.asList(
            "text", "review", "comment", "sentence", "content", "tweet", "post", "message", "body"));
    private static final Set<String> LABEL_NAMES = new HashSet<>(Arrays.asList(
            "label", "sentiment", "class", "target", "polarity", "category"));

    public final List<Sample> samples = new ArrayList<>();
    public int skipped;              // rows with no text or an unknown label (a header row counts here)
    public int duplicatesRemoved;    // exact repeats of the same text and label
    public int conflicting;          // texts dropped because they had two different labels
    public String mapping = "";      // how the labels were read, shown to the user

    public static Dataset parse(String csv) {
        Dataset d = new Dataset();
        List<String[]> rows = Csv.parse(csv);
        if (rows.isEmpty()) return d;

        int tc = -1, lc = -1, start = 0;
        String[] head = rows.get(0);
        for (int i = 0; i < head.length; i++) {
            String h = head[i].trim().toLowerCase(Locale.ROOT);
            if (tc < 0 && TEXT_NAMES.contains(h)) tc = i;
            else if (lc < 0 && LABEL_NAMES.contains(h)) lc = i;
        }
        boolean named = tc >= 0 && lc >= 0;
        if (named) start = 0;

        List<String[]> pairs = new ArrayList<>();          // {text, rawLabel}
        for (int i = start; i < rows.size(); i++) {
            String[] r = rows.get(i);
            if (named) {
                if (i == 0) continue;                       // header row
                if (r.length <= Math.max(tc, lc)) { d.skipped++; continue; }
                pairs.add(new String[]{r[tc], r[lc]});
            } else {
                if (r.length < 2) { d.skipped++; continue; }
                pairs.add(new String[]{r[0], r[r.length - 1]});
            }
        }

        // Decide how to read the labels: words first, else numbers.
        boolean wordMode = false;
        for (String[] p : pairs) if (Labels.parse(p[1]) >= 0) { wordMode = true; break; }
        Map<Integer, Integer> numeric = null;
        if (!wordMode) {
            numeric = numericMap(pairs);
            if (numeric == null) { d.skipped += pairs.size(); d.mapping = "labels not understood"; return d; }
            d.mapping = describe(numeric);
        } else d.mapping = "labels read as words (positive / neutral / negative)";

        Map<String, Integer> seen = new HashMap<>();        // normalised text -> index in samples (or -1 = dropped)
        for (String[] p : pairs) {
            String text = p[0] == null ? "" : p[0].trim();
            int label = wordMode ? Labels.parse(p[1]) : numericLabel(numeric, p[1]);
            if (text.isEmpty() || label < 0) { d.skipped++; continue; }
            String key = text.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
            Integer at = seen.get(key);
            if (at == null) { seen.put(key, d.samples.size()); d.samples.add(new Sample(text, label)); }
            else if (at == -1) d.duplicatesRemoved++;
            else if (d.samples.get(at).label == label) d.duplicatesRemoved++;
            else { d.conflicting++; seen.put(key, -1); d.samples.set(at, null); }
        }
        d.samples.removeIf(Objects::isNull);
        return d;
    }

    /** Maps the numbers found in the label column to our three classes, or returns null if they look unfamiliar. */
    private static Map<Integer, Integer> numericMap(List<String[]> pairs) {
        TreeSet<Integer> nums = new TreeSet<>();
        for (String[] p : pairs) {
            try { nums.add((int) Math.round(Double.parseDouble(p[1].trim()))); } catch (Exception ignored) { }
        }
        if (nums.size() < 2) return null;
        Map<Integer, Integer> m = new HashMap<>();           // number -> class index (0 pos, 1 neu, 2 neg)
        if (all(nums, 0, 1)) { m.put(0, 2); m.put(1, 0); }
        else if (all(nums, -1, 0, 1)) { m.put(-1, 2); m.put(0, 1); m.put(1, 0); }
        else if (all(nums, 0, 1, 2)) { m.put(0, 2); m.put(1, 1); m.put(2, 0); }
        else if (all(nums, 0, 2, 4)) { m.put(0, 2); m.put(2, 1); m.put(4, 0); }
        else if (all(nums, 1, 2, 3, 4, 5)) { m.put(1, 2); m.put(2, 2); m.put(3, 1); m.put(4, 0); m.put(5, 0); }
        else return null;
        return m;
    }

    private static boolean all(Set<Integer> nums, int... allowed) {
        Set<Integer> ok = new HashSet<>();
        for (int a : allowed) ok.add(a);
        return ok.containsAll(nums);
    }

    private static int numericLabel(Map<Integer, Integer> m, String raw) {
        try { Integer v = m.get((int) Math.round(Double.parseDouble(raw.trim()))); return v == null ? -1 : v; }
        catch (Exception e) { return -1; }
    }

    private static String describe(Map<Integer, Integer> m) {
        List<Integer> keys = new ArrayList<>(m.keySet());
        Collections.sort(keys);
        StringBuilder sb = new StringBuilder("numeric labels read as ");
        for (int i = 0; i < keys.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(keys.get(i)).append("=").append(Labels.NAMES[m.get(keys.get(i))].toLowerCase(Locale.ROOT));
        }
        return sb.toString();
    }

    public int[] counts() {
        int[] c = new int[3];
        for (Sample s : samples) c[s.label]++;
        return c;
    }
}
