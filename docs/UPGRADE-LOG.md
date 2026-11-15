# Upgrade log

## Step 1: honest numbers, safe server, ready for the cloud

| Change | Why |
|---|---|
| Fixed path traversal in `StaticHandler` (`/../data/history.csv` was readable) | A public site must never serve files outside `web/`. Now only `index.html`, `app.js`, `style.css` are served. |
| Duplicate and conflicting rows removed before training | The same sentence can no longer be in both the training and the test part. |
| Stratified split, "biggest class" baseline, 5-fold cross-validation | An accuracy means nothing without a baseline and a spread. |
| Macro F1 counts only classes that exist in the test data | A 2-class dataset (positive/negative) was being scored as if neutral was always wrong. |
| CSV import reads header names and numeric labels (0/1, -1/0/1, 0/1/2, 0/2/4, 1-5 stars) | So real public datasets work without editing them by hand. |
| `PORT` environment variable, `/api/health`, `READ_ONLY=true` mode | Cloud hosts set the port and ping a health URL. A public demo must not let visitors wipe data or retrain. |
| 40 MB request limit, `tools/make-sample.mjs` | A 50,000-row file is too big to upload as it is. The tool makes a balanced smaller sample. |
| `Dockerfile`, `.dockerignore` | One command to build and run the same app anywhere. Not yet built on a real Docker daemon. |
| `.github/workflows/ci.yml` | Every push compiles the code and runs the self test. |
| Self test grew from 19 to 34 checks | Covers every change above, including the HTTP server. |

### What we found
On the bundled sample data both engines score 100% on every fold (baseline 35%). That data is too easy to tell the engines apart. Real data is the next step.
