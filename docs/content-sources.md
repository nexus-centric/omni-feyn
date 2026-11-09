# Content sources for the topic bank

Checked on 2026-11-06 for the content expansion (565 items; see DESIGN.md section 2).

## What was checked and what was not

- All 26 named books in the bank were matched by title and author against the Open Library
  catalogue (`scripts/verify-books.mjs`, output in `tmp/books-check.json`). Two were confirmed
  through the original edition: Norman's book first appeared as "The Psychology of Everyday Things"
  (1988) and was retitled; Piketty's book was written in French ("Le capital au XXIe siècle", 2013)
  and published in English by Harvard University Press (Belknap) in 2014. The Basic Books
  (Hachette) page for "The Design of Everyday Things" was also opened.
- 20 research papers behind the psychology and phenomena subjects were resolved by DOI through
  the Crossref API, and 5 institutional pages were opened and their page titles checked to rule out
  soft 404 pages (`scripts/verify-refs.mjs`, output in `tmp/refs-check.json`). One DOI written from
  memory was wrong (the moon illusion paper) and was corrected through a Crossref search.
- This is a sampled check, not a full fact-check. The bank contains questions and subjects, not
  factual claims; the 1-minute opinion prompts, general subjects (for example "game theory") and
  well-known textbook phenomena were not individually sourced. Open Library publication years are
  inconsistent (they often list a later edition), so the bank does not state publication years
  except for two classics (1776, 1859) that the catalogue confirms.
- No Vietnamese edition is claimed for any book. Book topics use the original title and author.
  Vietnamese keywords next to a book (for example a descriptive Vietnamese phrase) are search
  aids, not edition titles.
- The links below are for this record only; they are not shown in the app.

## Books (Open Library work records)

| Depth | Book | Author(s) | Record |
| --- | --- | --- | --- |
| minute | Nineteen Eighty-Four | George Orwell | https://openlibrary.org/works/OL1168083W |
| minute | Animal Farm | George Orwell | https://openlibrary.org/works/OL1168007W |
| minute | The Alchemist | Paulo Coelho | https://openlibrary.org/works/OL42974242W |
| day | The Psychology of Money | Morgan Housel | https://openlibrary.org/works/OL21640039W |
| day | Atomic Habits | James Clear | https://openlibrary.org/works/OL17930368W |
| day | The Black Swan | Nassim Nicholas Taleb | https://openlibrary.org/works/OL3295030W |
| day | Influence | Robert B. Cialdini | https://openlibrary.org/works/OL3902892W |
| day | The Phoenix Project | Gene Kim, Kevin Behr, George Spafford | https://openlibrary.org/works/OL16806686W |
| day | Factfulness | Hans Rosling, Ola Rosling, Anna Rosling Rönnlund | https://openlibrary.org/works/OL17877260W |
| day | Deep Work | Cal Newport | https://openlibrary.org/works/OL17713267W |
| day | The Design of Everyday Things | Don (Donald A.) Norman | https://openlibrary.org/works/OL1879162W |
| day | Freakonomics | Steven D. Levitt, Stephen J. Dubner | https://openlibrary.org/works/OL278022W |
| day | Man's Search for Meaning | Viktor E. Frankl | https://openlibrary.org/works/OL43270708W |
| week | Sapiens | Yuval Noah Harari | https://openlibrary.org/works/OL17075811W |
| week | Guns, Germs, and Steel | Jared Diamond | https://openlibrary.org/works/OL276558W |
| week | The Selfish Gene | Richard Dawkins | https://openlibrary.org/works/OL1966488W |
| week | Accelerate | Nicole Forsgren, Jez Humble, Gene Kim | https://openlibrary.org/works/OL19542983W |
| week | Nudge | Richard H. Thaler, Cass R. Sunstein | https://openlibrary.org/works/OL3936258W |
| week | Why Nations Fail | Daron Acemoglu, James A. Robinson | https://openlibrary.org/works/OL16568759W |
| week | Designing Data-Intensive Applications | Martin Kleppmann | https://openlibrary.org/works/OL19293745W |
| week | The Mythical Man-Month | Frederick P. Brooks | https://openlibrary.org/works/OL3510570W |
| deep | The Wealth of Nations | Adam Smith | https://openlibrary.org/works/OL76827W |
| deep | On the Origin of Species | Charles Darwin | https://openlibrary.org/works/OL515051W |
| deep | The Structure of Scientific Revolutions | Thomas S. Kuhn | https://openlibrary.org/works/OL3259254W |
| deep | Gödel, Escher, Bach | Douglas R. Hofstadter | https://openlibrary.org/works/OL716850W |
| deep | Capital in the Twenty-First Century | Thomas Piketty | https://openlibrary.org/works/OL16814568W |

## Research behind psychology subjects

Subjects marked `disputed` in the bank show the "Còn tranh luận" label.

| Subject (bank title) | Flag | Reference (DOI) |
| --- | --- | --- |
| Thí nghiệm kẹo dẻo (marshmallow test) | disputed | Watts, Duncan and Quan 2018, Psychological Science, 10.1177/0956797618761661 |
| Suy kiệt ý chí (ego depletion) | disputed | Hagger et al. 2016, multilab replication, 10.1177/1745691616652873 |
| Tư thế quyền lực (power posing) | disputed | Carney, Cuddy and Yap 2010, 10.1177/0956797610383437; Ranehill et al. 2015, 10.1177/0956797614553946 |
| Thí nghiệm nhà tù Stanford | disputed | Le Texier 2019, American Psychologist, 10.1037/amp0000401 |
| Thí nghiệm vâng lời của Milgram | disputed | Burger 2009, partial replication, 10.1037/a0010932 |
| Khủng hoảng tái lập trong tâm lý học; Hiệu ứng mồi | priming: disputed | Open Science Collaboration 2015, Science, 10.1126/science.aac4716 |
| Học theo "phong cách học" (learning styles) | disputed | Pashler et al. 2008, 10.1111/j.1539-6053.2009.01038.x |
| Hình thành một thói quen mất bao lâu; Atomic Habits | none | Lally et al. 2010 (Crossref lists 2009 online), 10.1002/ejsp.674 |
| Vì sao ngáp có vẻ lây | none | Massen and Gallup 2017, 10.1016/j.neubiorev.2017.07.006 |
| Vì sao ta không tự cù mình được | none | Blakemore, Wolpert and Frith 1998, 10.1038/2870 |
| Quá nhiều lựa chọn (choice overload, minute) | disputed | Labelled from general knowledge of mixed meta-analytic results; no DOI checked |
| Tâm lý học tiến hoá và những phản biện (deep) | disputed | Broad field with well-known methodological critiques; no single source |

## Research and institutional pages behind phenomena

| Subject | Reference |
| --- | --- |
| Hiệu ứng Mpemba (disputed) | Mpemba and Osborne 1969, 10.1088/0031-9120/4/3/312; Burridge and Linden 2016, 10.1038/srep37665 |
| Định luật Benford | Hill 1995, Statistical Science, 10.1214/ss/1177009869 |
| Hiệu ứng cánh bướm và hỗn loạn | Lorenz 1963, 10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2 |
| Hiệu ứng Matthew | Merton 1968, Science, 10.1126/science.159.3810.56 |
| Nghịch lý Braess | Braess, Nagurney and Wakolbinger 2005 (English translation), 10.1287/trsc.1050.0127 |
| Kẹt xe không có nguyên nhân rõ ràng | Sugiyama et al. 2008, New Journal of Physics, 10.1088/1367-2630/10/3/033001 |
| Ảo giác Mặt Trăng | Kaufman and Rock 1962, Science, 10.1126/science.136.3520.953 |
| Mùi cơn mưa đầu mùa (petrichor) | Bear and Thomas 1964, Nature, 10.1038/201993a0 |
| Nghịch lý Simpson | Stanford Encyclopedia of Philosophy, https://plato.stanford.edu/entries/paradox-simpson/ |
| Đảo nhiệt đô thị | US EPA, https://www.epa.gov/heatislands |
| Cực quang | NOAA Space Weather Prediction Center, https://www.swpc.noaa.gov/phenomena/aurora |
| Sét hình thành thế nào | NOAA NSSL, https://www.nssl.noaa.gov/education/svrwx101/lightning/ |
| Nước biển mặn, nước sông nhạt | NOAA Ocean Service, https://oceanservice.noaa.gov/facts/whysalty.html |

Not individually sourced: the Coriolis drain question (phrased as a question because the popular
claim is a common myth; a NOAA page tried for it returned a "Page Not Found" title), the Doppler
effect, the birthday problem, the Jevons paradox, the Streisand effect, and the everyday "why"
prompts (sunsets, autumn leaves, noise-cancelling headphones, flight, mountains being colder).

## Re-running the checks

    node scripts/verify-books.mjs
    node scripts/verify-refs.mjs

Both need network access and write JSON into `tmp/`. Open Library and Crossref are public APIs;
Britannica blocked automated requests (HTTP 403) during this check and was not used.
