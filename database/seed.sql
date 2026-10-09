-- Hikaya seed. Run after schema.sql, then seed-generated.sql.
BEGIN;
DELETE FROM quiz_questions; DELETE FROM timeline_events; DELETE FROM contributions; DELETE FROM media;
DELETE FROM stories; DELETE FROM location_categories; DELETE FROM categories; DELETE FROM locations;
DELETE FROM users WHERE email IN ('editor@hikaya.ps', 'content@hikaya.ps');

INSERT INTO users (id, full_name, email, password_hash, role) VALUES
('user-editor','Hikaya Editorial Team','editor@hikaya.ps',NULL,'editor'),
('user-content','Jerusalem Content Documentation Team','content@hikaya.ps',NULL,'editor');

INSERT INTO categories (id,name,description) VALUES
('cat-quarter','حارة تاريخية','Historic quarters and lanes of Jerusalem.'),
('cat-sacred','معلم ديني','Sacred sites and places of worship.'),
('cat-souq','سوق تراثي','Living traditional markets and food heritage.'),
('cat-neighborhood','حي مقدسي','Jerusalem neighbourhoods beyond the Old City walls.'),
('cat-oral','ذاكرة شفوية','Attributed community memories requiring editorial review.');

INSERT INTO locations (id,name,arabic_name,city,country,latitude,longitude,description,cover_image_url,content_file,ai_summary_file,is_published) VALUES
('muslim-quarter','Muslim Quarter','حارة المسلمين','Jerusalem','Palestine',31.7806,35.2339,'The Old City’s largest quarter, shaped by Mamluk architecture, living markets and routes leading toward Al-Aqsa.','https://commons.wikimedia.org/wiki/Special:FilePath/Souq_al-Qattanin_%D8%B3%D9%88%D9%82_%D8%A7%D9%84%D9%82%D8%B7%D8%A7%D9%86%D9%8A%D9%86_%D8%A7%D9%84%D9%82%D8%AF%D8%B3.jpg?width=1600','content/ai-ready/muslim-quarter-summary.md','content/ai-ready/muslim-quarter-summary.md',TRUE),
('christian-quarter','Christian Quarter','حارة النصارى','Jerusalem','Palestine',31.7784,35.2297,'A quarter of churches, monasteries, hospices and markets centred on the Church of the Holy Sepulchre.','https://commons.wikimedia.org/wiki/Special:FilePath/Christian_Quarter_IMG_0431.jpg?width=1600','content/ai-ready/christian-quarter-summary.md','content/ai-ready/christian-quarter-summary.md',TRUE),
('armenian-quarter','Armenian Quarter','حارة الأرمن','Jerusalem','Palestine',31.7747,35.2294,'A compact historic quarter known for St James Cathedral, Armenian institutions and Jerusalem’s ceramic tradition.','https://commons.wikimedia.org/wiki/Special:FilePath/Entrance_to_the_Cathedral_of_Saint_James_in_the_Armenian_Quarter_of_Jerusalem.jpg?width=1600','content/ai-ready/armenian-quarter-summary.md','content/ai-ready/armenian-quarter-summary.md',TRUE),
('maghariba-quarter','Maghariba Quarter','حي وحارة المغاربة','Jerusalem','Palestine',31.7755,35.2338,'The remembered Maghrebi Quarter beside Bab al-Maghariba and al-Buraq Wall, documented as an endowed urban community.','https://commons.wikimedia.org/wiki/Special:FilePath/19th_century_view_of_Jerusalem%2C_including_the_Moroccan_Quarter.jpg?width=1600','content/ai-ready/maghariba-quarter-summary.md','content/ai-ready/maghariba-quarter-summary.md',TRUE),
('sheikh-jarrah','Sheikh Jarrah','حي الشيخ جراح','Jerusalem','Palestine',31.7917,35.2295,'A Jerusalem neighbourhood known for historic villas, cultural institutions and steadfast family life.','https://commons.wikimedia.org/wiki/Special:FilePath/Kharufe_house_Sheikh_Jarrah.JPG?width=1600','content/ai-ready/sheikh-jarrah-summary.md','content/ai-ready/sheikh-jarrah-summary.md',TRUE),
('silwan','Silwan','سلوان','Jerusalem','Palestine',31.7707,35.2368,'A hillside Jerusalem neighbourhood tied to Ain Silwan, Wadi Hilweh, terraced gardens and oral memory.','https://commons.wikimedia.org/wiki/Special:FilePath/%D9%82%D8%B1%D9%8A%D8%A9_%D8%B3%D9%84%D9%88%D8%A7%D9%86.jpg?width=1600','content/ai-ready/silwan-summary.md','content/ai-ready/silwan-summary.md',TRUE),
('at-tur','At-Tur & Mount of Olives','الطور وجبل الزيتون','Jerusalem','Palestine',31.7833,35.2442,'The eastern ridge: a living neighbourhood and landscape of panoramas, shrines, churches and cemeteries.','https://commons.wikimedia.org/wiki/Special:FilePath/Jerusalem_panorama_from_Mount_of_Olives.jpg?width=1600','content/ai-ready/at-tur-summary.md','content/ai-ready/at-tur-summary.md',TRUE),
('bab-al-amud','Bab al-Amud','باب العامود ومحيطه','Jerusalem','Palestine',31.7816,35.2308,'Jerusalem’s monumental northern gate and civic gathering place opening into Khan al-Zeit market.','https://commons.wikimedia.org/wiki/Special:FilePath/125307_jerusalem_-_nablus_gate_square_entrance_PikiWiki_Israel.jpg?width=1600','content/ai-ready/bab-al-amud-summary.md','content/ai-ready/bab-al-amud-summary.md',TRUE);

INSERT INTO location_categories VALUES
('muslim-quarter','cat-quarter'),('muslim-quarter','cat-sacred'),('muslim-quarter','cat-souq'),
('christian-quarter','cat-quarter'),('christian-quarter','cat-sacred'),('christian-quarter','cat-souq'),
('armenian-quarter','cat-quarter'),('armenian-quarter','cat-sacred'),('maghariba-quarter','cat-quarter'),('maghariba-quarter','cat-sacred'),
('sheikh-jarrah','cat-neighborhood'),('silwan','cat-neighborhood'),('at-tur','cat-neighborhood'),('at-tur','cat-sacred'),
('bab-al-amud','cat-quarter'),('bab-al-amud','cat-souq');

INSERT INTO stories (id,location_id,author_id,title,summary,original_content,simplified_story,audience,language,tone,source,is_ai_generated,uncertainty_notes,status)
SELECT 'story-'||id,id,'user-editor',name||': a Jerusalem walk',description,ai_summary_file,
name||' ('||arabic_name||') is one of the eight focused Jerusalem places in Hikaya. '||description||' Open the reviewed timeline, gallery and memories to follow what the documentation supports; where the record has a gap, the guide will not guess.',
'general','en','storytelling',content_file,FALSE,'{}','published' FROM locations;

INSERT INTO contributions (id,reference_code,location_id,user_id,category_id,title,content,contributor_name,status,review_notes,reviewed_at,submitted_at) VALUES
('contribution-kaak','HQ-KAAK26','bab-al-amud',NULL,'cat-oral','ذكريات كعك القدس عند باب العامود','أتذكر رائحة السمسم في الصباح، وبائع الكعك يحمل صينيته قرب الدرج. كانت الوقفة عند باب العامود بداية الطريق إلى السوق.','ذاكرة مقدسية','approved','Published as attributed oral memory; not treated as verified historical fact.',NOW(),NOW()-INTERVAL '2 days'),
('contribution-nabi-musa','HQ-MUSA26','muslim-quarter',NULL,'cat-oral','من موسم النبي موسى','كانت العائلة تتحدث عن المواكب والأعلام والأناشيد التي تعبر طرق القدس في موسم النبي موسى. هذه ذاكرة عائلية مقدّمة بوصفها تراثاً شفوياً.','ذاكرة مقدسية','approved','Published as attributed oral memory; not treated as verified historical fact.',NOW(),NOW()-INTERVAL '2 days'),
('contribution-sadiyya','HQ-SAAD26','muslim-quarter',NULL,'cat-oral','حكاية من حارة السعدية','صوت الأبواب الحجرية والجيران وهم يتبادلون الأطباق في رمضان هو ما بقي في ذاكرتي.','ذاكرة مقدسية','approved','Published as attributed oral memory; not treated as verified historical fact.',NOW(),NOW()-INTERVAL '2 days'),
('contribution-silwan','HQ-SILW26','silwan',NULL,'cat-oral','ماء العين وبساتين سلوان','تحكي جدتي عن الطريق إلى عين سلوان وعن سقاية الأشجار في البساتين. نسجلها هنا كذاكرة شخصية لا كإثبات تاريخي.','ذاكرة مقدسية','approved','Published as attributed oral memory; not treated as verified historical fact.',NOW(),NOW()-INTERVAL '2 days');
COMMIT;
