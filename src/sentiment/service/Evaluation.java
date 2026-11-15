package sentiment.service;

import sentiment.analyzer.*;

import java.util.*;

/**
 * Measures how good an analyzer is on labelled data.
 * Honest-number rules used here:
 *  - the split is stratified (every class keeps its share in train and test),
 *  - Naive Bayes is trained on the training part only,
 *  - macro F1 counts only classes that really exist in the test data,
 *  - a "biggest class" baseline is reported, so an accuracy can be judged against doing nothing smart,
 *  - k-fold cross-validation shows how much the number moves when the split changes.
 */
public final class Evaluation {
    private Evaluation() { }

    public static Map<String, Object> run(List<Sample> data, double testFraction, long seed, Analyzer lexicon) {
        List<List<Sample>> byClass = group(data, seed);
        List<Sample> test = new ArrayList<>(), train = new ArrayList<>();
        for (List<Sample> g : byClass) {
            int nTest = g.size() < 2 ? 0 : Math.max(1, (int) Math.round(g.size() * testFraction));
            test.addAll(g.subList(0, nTest));
            train.addAll(g.subList(nTest, g.size()));
        }
        Collections.shuffle(test, new Random(seed));
        NaiveBayesAnalyzer nb = new NaiveBayesAnalyzer();       // trained on the training part only
        nb.train(train);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("trainSize", train.size()); out.put("testSize", test.size());
        List<Object> models = new ArrayList<>();
        models.add(metrics(lexicon, test));
        models.add(metrics(nb, test));
        out.put("models", models);
        out.put("baseline", baseline(train, test));
        out.put("crossValidation", crossValidate(data, 5, seed, lexicon));
        return out;
    }

    /** Samples grouped by class, each group shuffled with the seed. */
    private static List<List<Sample>> group(List<Sample> data, long seed) {
        List<List<Sample>> g = new ArrayList<>();
        for (int c = 0; c < 3; c++) g.add(new ArrayList<>());
        for (Sample s : data) g.get(s.label).add(s);
        for (List<Sample> l : g) Collections.shuffle(l, new Random(seed));
        return g;
    }

    /** Accuracy of always answering with the class that is biggest in the training part. */
    private static Map<String, Object> baseline(List<Sample> train, List<Sample> test) {
        int[] c = new int[3];
        for (Sample s : train) c[s.label]++;
        int best = 0;
        for (int i = 1; i < 3; i++) if (c[i] > c[best]) best = i;
        int ok = 0;
        for (Sample s : test) if (s.label == best) ok++;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", Labels.NAMES[best]);
        m.put("accuracy", test.isEmpty() ? 0.0 : (double) ok / test.size());
        return m;
    }

    /** Stratified k-fold cross-validation of Naive Bayes, with the lexicon scored on the same folds. */
    static Map<String, Object> crossValidate(List<Sample> data, int k, long seed, Analyzer lexicon) {
        List<List<Sample>> byClass = group(data, seed);
        List<List<Sample>> folds = new ArrayList<>();
        for (int i = 0; i < k; i++) folds.add(new ArrayList<>());
        for (List<Sample> g : byClass) for (int i = 0; i < g.size(); i++) folds.get(i % k).add(g.get(i));

        List<Object> per = new ArrayList<>();
        double[] nbAcc = new double[k], lexAcc = new double[k];
        int used = 0;
        for (int f = 0; f < k; f++) {
            List<Sample> test = folds.get(f), train = new ArrayList<>();
            for (int o = 0; o < k; o++) if (o != f) train.addAll(folds.get(o));
            if (test.isEmpty() || train.isEmpty()) continue;
            NaiveBayesAnalyzer nb = new NaiveBayesAnalyzer();
            nb.train(train);
            nbAcc[used] = accuracy(nb, test);
            lexAcc[used] = accuracy(lexicon, test);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fold", f + 1); m.put("naiveBayes", nbAcc[used]); m.put("lexicon", lexAcc[used]);
            per.add(m);
            used++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("folds", used);
        out.put("naiveBayesMean", mean(nbAcc, used)); out.put("naiveBayesStd", std(nbAcc, used));
        out.put("lexiconMean", mean(lexAcc, used)); out.put("lexiconStd", std(lexAcc, used));
        out.put("perFold", per);
        return out;
    }

    private static double accuracy(Analyzer a, List<Sample> test) {
        int ok = 0;
        for (Sample s : test) if (Labels.index(a.analyze(s.text).label) == s.label) ok++;
        return test.isEmpty() ? 0 : (double) ok / test.size();
    }

    static double mean(double[] v, int n) {
        if (n == 0) return 0;
        double s = 0;
        for (int i = 0; i < n; i++) s += v[i];
        return s / n;
    }

    static double std(double[] v, int n) {
        if (n < 2) return 0;
        double m = mean(v, n), s = 0;
        for (int i = 0; i < n; i++) s += (v[i] - m) * (v[i] - m);
        return Math.sqrt(s / (n - 1));
    }

    static Map<String, Object> metrics(Analyzer a, List<Sample> test) {
        int[][] cm = new int[3][3];                              // rows = actual, columns = predicted
        for (Sample s : test) cm[s.label][Labels.index(a.analyze(s.text).label)]++;
        int correct = 0;
        for (int i = 0; i < 3; i++) correct += cm[i][i];
        List<Object> per = new ArrayList<>();
        double f1sum = 0;
        int classes = 0;
        for (int c = 0; c < 3; c++) {
            int tp = cm[c][c], fp = 0, fn = 0;
            for (int k = 0; k < 3; k++) if (k != c) { fp += cm[k][c]; fn += cm[c][k]; }
            double p = tp + fp == 0 ? 0 : (double) tp / (tp + fp), r = tp + fn == 0 ? 0 : (double) tp / (tp + fn);
            double f1 = p + r == 0 ? 0 : 2 * p * r / (p + r);
            if (tp + fn > 0) { f1sum += f1; classes++; }      // only classes that exist in the test data
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", Labels.NAMES[c]); m.put("precision", p); m.put("recall", r); m.put("f1", f1); m.put("support", tp + fn);
            per.add(m);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id()); m.put("name", a.name());
        m.put("accuracy", test.isEmpty() ? 0.0 : (double) correct / test.size());
        m.put("macroF1", classes == 0 ? 0.0 : f1sum / classes);
        m.put("confusion", cm); m.put("perClass", per);
        return m;
    }
}
