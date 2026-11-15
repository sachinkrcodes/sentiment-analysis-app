package sentiment.test;

import sentiment.analyzer.*;
import sentiment.storage.LexiconStore;
import sentiment.util.Csv;
import sentiment.util.Json;
import sentiment.util.Res;

import java.util.*;

/**
 * Offline self-test (no network): checks the lexicon analyzer's rules and the Naive Bayes classifier's
 * accuracy on the bundled training set, plus the small Json/Csv helpers.
 * Run: java -cp out sentiment.test.EngineSelfTest
 */
public final class EngineSelfTest {
    static int checks, failures;

    static void check(boolean ok, String msg) {
        checks++;
        if (!ok) { failures++; System.out.println("FAIL: " + msg); }
    }

    public static void main(String[] args) throws Exception {
        LexiconStore lex = new LexiconStore();
        LexiconAnalyzer a = new LexiconAnalyzer(lex);

        check(a.analyze("I love this, it is great!").label.equals("Positive"), "clearly positive text");
        check(a.analyze("I hate this, it is terrible.").label.equals("Negative"), "clearly negative text");
        check(a.analyze("The parcel arrived on Tuesday.").label.equals("Neutral"), "neutral factual text");
        check(a.analyze("The delivery was okay, nothing special.").label.equals("Neutral"), "'nothing special' is neutral, not positive");
        check(a.analyze("This is not good at all.").compound < 0, "negation should flip polarity");
        Result caps = a.analyze("This is GREAT");
        Result plain = a.analyze("this is great");
        check(caps.compound > plain.compound, "ALL CAPS should increase intensity");
        Result bang = a.analyze("great!!!");
        Result noBang = a.analyze("great");
        check(bang.compound > noBang.compound, "exclamation marks should increase intensity");
        Result veryGood = a.analyze("this is very good");
        Result good = a.analyze("this is good");
        check(veryGood.compound > good.compound, "booster word should increase intensity");

        // JSON round trip
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("a", 1.5); m.put("b", "hi \"there\""); m.put("c", Arrays.asList(1, 2, 3));
        String j = Json.write(m);
        Object back = Json.parse(j);
        check(back instanceof Map && ((Map<?, ?>) back).get("b").equals("hi \"there\""), "JSON round trip preserves strings");

        // CSV with quotes and commas
        List<String[]> rows = Csv.parse("text,label\n\"hello, world\",positive\n\"line1\nline2\",neutral\n");
        check(rows.size() == 3 && rows.get(1)[0].equals("hello, world"), "CSV parses quoted commas");
        check(rows.get(2)[0].equals("line1\nline2"), "CSV parses quoted newlines");

        // Naive Bayes: train/test split on the bundled dataset, expect solid accuracy
        String csv = Res.readDefault("data/training.csv");
        check(csv != null, "bundled training.csv is readable");
        Dataset d = Dataset.parse(csv);
        check(d.samples.size() > 100, "bundled dataset has a reasonable number of rows");
        List<Sample> all = new ArrayList<>(d.samples);
        Collections.shuffle(all, new Random(1));
        int nTest = all.size() / 4;
        List<Sample> test = all.subList(0, nTest), train = all.subList(nTest, all.size());
        NaiveBayesAnalyzer nb = new NaiveBayesAnalyzer();
        nb.train(train);
        int correct = 0;
        for (Sample s : test) if (nb.analyze(s.text).label.equals(Labels.NAMES[s.label])) correct++;
        double acc = (double) correct / test.size();
        check(acc > 0.75, "Naive Bayes test accuracy should be reasonably high, was " + acc);
        System.out.println("Naive Bayes held-out accuracy: " + String.format(Locale.ROOT, "%.1f%%", acc * 100));

        // Retraining changes predictions (proves it is not hard-coded)
        List<Sample> tiny = Arrays.asList(new Sample("zibblewonk", 0), new Sample("zibblewonk", 0), new Sample("gorptastic", 2), new Sample("gorptastic", 2));
        NaiveBayesAnalyzer nb2 = new NaiveBayesAnalyzer();
        nb2.train(tiny);
        check(nb2.analyze("zibblewonk").label.equals("Positive"), "NB should learn an unseen made-up word as positive");
        check(nb2.analyze("gorptastic").label.equals("Negative"), "NB should learn an unseen made-up word as negative");

        // Lexicon editing at runtime
        check(lex.get("zzcustomword") == null, "unknown word starts unscored");
        lex.set("zzcustomword", 3.0);
        check(lex.get("zzcustomword") == 3.0, "custom word can be added");
        check(a.analyze("zzcustomword").label.equals("Positive"), "custom word affects analysis immediately");
        lex.remove("zzcustomword");
        check(lex.get("zzcustomword") == null, "custom word can be removed");


        // ---- dataset reading: header names, numeric labels, duplicates ----
        Dataset bin = Dataset.parse("review,sentiment\n\"Great, really great\",1\n\"Awful and slow\",0\n\"Great, really great\",1\n\"Loved it\",1\n\"Hated it\",0\n");
        check(bin.samples.size() == 4, "duplicate text is removed, got " + bin.samples.size());
        check(bin.duplicatesRemoved == 1, "one duplicate counted");
        check(bin.counts()[0] == 2 && bin.counts()[2] == 2, "0/1 labels read as negative/positive");
        Dataset stars = Dataset.parse("text,rating\nbad,1\nok,3\ngood,5\nbetter,4\nworse,2\n");
        check(stars.counts()[0] == 2 && stars.counts()[1] == 1 && stars.counts()[2] == 2, "1-5 stars read as neg/neu/pos");
        Dataset words = Dataset.parse("text,label\nI love it,positive\nI hate it,Negative\nIt is a table,neutral\n");
        check(words.samples.size() == 3 && words.skipped == 0, "word labels and header row handled");
        Dataset clash = Dataset.parse("text,label\nsame words,positive\nSame  words,negative\nother,positive\n");
        check(clash.conflicting == 1 && clash.samples.size() == 1, "same text with two labels is dropped");
        check(Dataset.parse("a,b\nx,hello\ny,world\n").samples.isEmpty(), "unknown labels give no rows");

        // ---- evaluation: stratified split, baseline, cross-validation, macro F1 ----
        List<Sample> synth = new ArrayList<>();
        for (int i = 0; i < 60; i++) synth.add(new Sample("wonderful superb item number " + i, 0));
        for (int i = 0; i < 20; i++) synth.add(new Sample("awful broken item number " + i, 2));
        Map<String, Object> ev = sentiment.service.Evaluation.run(synth, 0.25, 7, a);
        check(((Number) ev.get("testSize")).intValue() == 20, "stratified test size is 25% of 80, was " + ev.get("testSize"));
        Map<?, ?> base = (Map<?, ?>) ev.get("baseline");
        check(Math.abs(((Number) base.get("accuracy")).doubleValue() - 0.75) < 1e-9 && base.get("label").equals("Positive"), "baseline is the biggest class share");
        Map<?, ?> cv = (Map<?, ?>) ev.get("crossValidation");
        check(((Number) cv.get("folds")).intValue() == 5, "5 folds were run");
        Map<?, ?> nbm = (Map<?, ?>) ((List<?>) ev.get("models")).get(1);
        double f1 = ((Number) nbm.get("macroF1")).doubleValue();
        check(f1 > 0.9 && f1 <= 1.0, "macro F1 ignores the empty neutral class, was " + f1);

        // ---- server: health, static-file safety, read-only mode ----
        sentiment.service.AnalysisService svc = new sentiment.service.AnalysisService();
        sentiment.web.Server srv = new sentiment.web.Server(svc, 0, true);
        srv.start();
        int port = srv.port();
        java.net.http.HttpClient http = java.net.http.HttpClient.newHttpClient();
        java.net.http.HttpResponse<String> r1 = http.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + "/api/health")).build(), java.net.http.HttpResponse.BodyHandlers.ofString());
        check(r1.statusCode() == 200 && r1.body().contains("\"status\":\"ok\""), "health endpoint answers ok");
        java.net.http.HttpResponse<String> r2 = http.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + "/api/history/clear")).POST(java.net.http.HttpRequest.BodyPublishers.ofString("{}")).build(), java.net.http.HttpResponse.BodyHandlers.ofString());
        check(r2.statusCode() == 403, "read-only mode blocks history clear, got " + r2.statusCode());
        java.net.http.HttpResponse<String> r3 = http.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + "/data/history.csv")).build(), java.net.http.HttpResponse.BodyHandlers.ofString());
        check(r3.statusCode() == 404, "files outside web/ are not served, got " + r3.statusCode());
        java.net.http.HttpResponse<String> r4 = http.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:" + port + "/")).build(), java.net.http.HttpResponse.BodyHandlers.ofString());
        check(r4.statusCode() == 200 && r4.body().contains("Sentiment Analysis"), "home page is served");
        srv.stop();

        System.out.println(checks + " checks, " + failures + " failed.");
        if (failures > 0) System.exit(1);
        System.out.println("ALL TESTS PASSED");
    }
}
