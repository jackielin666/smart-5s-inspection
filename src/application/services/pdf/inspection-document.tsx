import React from 'react';
import path from 'node:path';
import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { InspectionPdfData } from './inspection-pdf-data';

Font.register({
  family: 'NotoTC',
  src: path.join(process.cwd(), 'public/fonts/NotoSansTC-Regular.otf'),
});

const BORDER = '#000';
const s = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 26, paddingHorizontal: 30, fontFamily: 'NotoTC', fontSize: 9, color: '#000' },
  company: { fontSize: 16, textAlign: 'center', fontWeight: 'bold' },
  title: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  // 整張表包一個外框，內部只畫分隔線，確保四邊與格線對齊
  table: { borderWidth: 1, borderColor: BORDER },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER },
  metaCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderColor: BORDER },
  legend: { borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 4, paddingHorizontal: 6 },
  tHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER, backgroundColor: '#f0f0f0' },
  sectionRow: { flexDirection: 'row' },
  cat: { width: 24, borderRightWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  catText: { fontSize: 9, lineHeight: 1.15 },
  itemsCol: { flex: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER },
  rowLast: { flexDirection: 'row' },
  itemCell: { flex: 1, paddingVertical: 3.8, paddingHorizontal: 6, borderRightWidth: 1, borderColor: BORDER },
  resCell: { width: 44, alignItems: 'center', justifyContent: 'center' },
  formCode: { position: 'absolute', bottom: 14, right: 30, fontSize: 9 },
  // 狀況說明頁
  noteBox: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, minHeight: 560 },
  noteLabel: { width: 24, borderRightWidth: 1, borderColor: BORDER, alignItems: 'center', paddingTop: 8 },
  noteBody: { flex: 1, padding: 8 },
  noteDate: { fontWeight: 'bold', marginTop: 6, marginBottom: 2 },
  noteItem: { marginBottom: 3, paddingLeft: 8 },
  // 狀況說明格子表：序號/缺失/建議/區域/班別 對齊；每格 View 包 Text → 自動換行、列高自動加高
  nTable: { borderWidth: 0.5, borderColor: '#666', marginTop: 2, marginBottom: 4 },
  nRow: { flexDirection: 'row', borderTopWidth: 0.5, borderColor: '#666', alignItems: 'stretch' },
  nRowFirst: { flexDirection: 'row', alignItems: 'stretch' },
  nHead: { backgroundColor: '#f0f0f0' },
  nSeq: { width: 20, paddingVertical: 2.5, paddingHorizontal: 3, borderRightWidth: 0.5, borderColor: '#666', justifyContent: 'center' },
  nSeqText: { textAlign: 'center' },
  nDesc: { flex: 2.2, paddingVertical: 2.5, paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: '#666' },
  nSugg: { flex: 1.6, paddingVertical: 2.5, paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: '#666' },
  nArea: { flex: 1.1, paddingVertical: 2.5, paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: '#666' },
  nUnit: { flex: 1.1, paddingVertical: 2.5, paddingHorizontal: 4 },
  // 簽核區：三欄平均分配、留高度給簽名
  signRow: { flexDirection: 'row', marginTop: 20 },
  signCell: { flex: 1, paddingHorizontal: 10 },
  signLabel: { fontSize: 10, textAlign: 'center', marginBottom: 4 },
  signSpace: { height: 34, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 2 },
  signName: { fontSize: 9, textAlign: 'center' },
  signUnderline: { borderTopWidth: 1, borderColor: BORDER, marginTop: 2 },
  h2: { fontSize: 12, textAlign: 'center', marginVertical: 6, fontWeight: 'bold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 2×3 一頁 6 張：高度 232（含說明文字）確保三列含頁首仍在一頁內
  photoBox: { width: '50%', height: 232, padding: 4, flexDirection: 'column' },
  // 文字方塊：靠左上，項次/日期/說明/區域/班別
  photoCaption: { fontSize: 8, textAlign: 'left', marginBottom: 2, fontWeight: 'bold' },
  photoInner: { flex: 1, borderWidth: 1, borderColor: '#999', backgroundColor: 'white' },
  // contain：維持照片原比例不裁切；照片統一靠右
  photo: { width: '100%', height: '100%', objectFit: 'contain', objectPositionX: '100%' },
  // 改善記錄：與缺失照片頁同尺寸（2欄大圖，一頁3組=6張）
  impBlock: { marginBottom: 4 },
  impPair: { flexDirection: 'row' },
  impCell: { width: '50%', height: 208, padding: 4 },
  impTag: {
    position: 'absolute',
    top: 3,
    left: 3,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  impEmpty: { margin: 'auto', color: '#999' },
  impDesc: { marginBottom: 2, fontWeight: 'bold' },
});

/** 三大類的縱向文字 */
function CatLabel({ name }: { name: string }) {
  return (
    <View style={s.cat}>
      <Text style={s.catText}>{name.split('').join('\n')}</Text>
    </View>
  );
}

function Header({ d }: { d: InspectionPdfData }) {
  return (
    <>
      <Text style={s.company}>{d.companyName}</Text>
      <Text style={s.title}>{d.formTitle}</Text>
    </>
  );
}

export function InspectionDocument({ data }: { data: InspectionPdfData }) {
  const mmdd = (iso: string) => iso.slice(5).replace('-', '/');

  // 照片頁＝狀況說明（第2頁）上每一筆「未結案」缺失的改善前照片，逐筆對應
  // 標題格式與第2頁一致：項次.(日期) 說明「區域」 - 「班別」
  const caption = (it: (typeof data.notesByDate)[number]['items'][number], i: number, date: string) =>
    `${i + 1}.(${mmdd(date)}) ${it.description}` +
    (it.areaName ? `「${it.areaName}」` : '') +
    (it.unitNames.length ? ` - 「${it.unitNames.join('、')}」` : '');
  const openPhotos = data.notesByDate.flatMap((grp) =>
    grp.items.flatMap((it, i) =>
      it.status === 'resolved'
        ? []
        : it.photos
            .filter((p) => p.kind === 'before')
            .map((p) => ({ src: p.src, caption: caption(it, i, grp.date) })),
    ),
  );
  // 每頁 6 張（2×3）
  const photoPages: (typeof openPhotos)[] = [];
  for (let i = 0; i < openPhotos.length; i += 6) photoPages.push(openPhotos.slice(i, i + 6));

  return (
    <Document>
      {/* 第 1 頁：檢查表 */}
      <Page size="A4" style={s.page}>
        <Header d={data} />
        <View style={s.table}>
          <View style={s.metaRow}>
            <View style={s.metaCell}>
              <Text>日 期 ︰ {data.rocDate}</Text>
            </View>
            <View style={[s.metaCell, { borderRightWidth: 0 }]}>
              <Text>區域位置： {data.area}</Text>
            </View>
          </View>
          <View style={[s.legend, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <Text>{data.legend}</Text>
            {data.completionNote ? <Text>{data.completionNote}</Text> : null}
          </View>

          <View style={s.tHead}>
            <View style={s.cat} />
            <View style={s.itemCell}>
              <Text>項目</Text>
            </View>
            <View style={s.resCell}>
              <Text>結果</Text>
            </View>
          </View>

          {data.sections.map((sec, si) => {
            const isLastSection = si === data.sections.length - 1;
            return (
              <View
                key={sec.name}
                style={[s.sectionRow, !isLastSection ? { borderBottomWidth: 1, borderColor: BORDER } : {}]}
              >
                <CatLabel name={sec.name.replace(/[、，]/g, '')} />
                <View style={s.itemsCol}>
                  {sec.items.map((it, ri) => {
                    const isLastRow = ri === sec.items.length - 1;
                    return (
                      <View key={it.itemNo} style={isLastRow ? s.rowLast : s.row}>
                        <View style={s.itemCell}>
                          <Text>
                            {it.itemNo - 1}. {it.content}
                          </Text>
                        </View>
                        <View style={s.resCell}>
                          <Text>{it.symbol}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        <Text style={s.formCode}>{data.formCode}</Text>
      </Page>

      {/* 第 2 頁：狀況說明（左側縱向標題框 + 簽核欄） */}
      <Page size="A4" style={s.page}>
        <Header d={data} />
        <View style={s.noteBox}>
          <View style={s.noteLabel}>
            <Text style={s.catText}>{'狀況說明'.split('').join('\n')}</Text>
          </View>
          <View style={s.noteBody}>
            {data.notesByDate.length === 0 && <Text style={s.noteItem}>（無缺失）</Text>}
            {data.notesByDate.map((grp) => (
              <View key={grp.date}>
                <Text style={s.noteDate}>{mmdd(grp.date)}</Text>
                <View style={s.nTable}>
                  <View style={[s.nRowFirst, s.nHead]}>
                    <View style={s.nSeq}><Text style={s.nSeqText}>#</Text></View>
                    <View style={s.nDesc}><Text>缺失說明</Text></View>
                    <View style={s.nSugg}><Text>改善建議</Text></View>
                    <View style={s.nArea}><Text>發生區域</Text></View>
                    <View style={s.nUnit}><Text>權責班別</Text></View>
                  </View>
                  {grp.items.map((it, i) => (
                    <View key={i} style={s.nRow}>
                      <View style={s.nSeq}><Text style={s.nSeqText}>{i + 1}</Text></View>
                      <View style={s.nDesc}><Text>{it.description}</Text></View>
                      <View style={s.nSugg}><Text>{it.suggestion ?? ''}</Text></View>
                      <View style={s.nArea}><Text>{it.areaName ?? ''}</Text></View>
                      <View style={s.nUnit}><Text>{it.unitNames.join('、')}</Text></View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={s.signRow}>
          <View style={s.signCell}>
            <Text style={s.signLabel}>廠長</Text>
            <View style={s.signSpace} />
            <View style={s.signUnderline} />
          </View>
          <View style={s.signCell}>
            <Text style={s.signLabel}>衛生管理人員</Text>
            <View style={s.signSpace} />
            <View style={s.signUnderline} />
          </View>
          <View style={s.signCell}>
            <Text style={s.signLabel}>檢查人員</Text>
            <View style={s.signSpace}>
              <Text style={s.signName}>{data.inspectors.join('、')}</Text>
            </View>
            <View style={s.signUnderline} />
          </View>
        </View>
        <Text style={s.formCode}>{data.formCode}</Text>
      </Page>

      {/* 第 3 頁起：未結案缺失照片 2×3（對應第2頁狀況說明） */}
      {photoPages.map((pg, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          <Header d={data} />
          <Text style={s.h2}>缺失照片（對應狀況說明）</Text>
          <View style={s.photoGrid}>
            {pg.map((p, i) => (
              <View key={i} style={s.photoBox}>
                <Text style={s.photoCaption}>{p.caption}</Text>
                <View style={s.photoInner}>
                  {p.src ? <Image style={s.photo} src={p.src} /> : null}
                </View>
              </View>
            ))}
          </View>
          <Text style={s.formCode}>{data.formCode}</Text>
        </Page>
      ))}

      {/* 改善記錄：改善前 / 改善後 對比 */}
      {data.improvements.length > 0 && (
        <Page size="A4" style={s.page}>
          <Header d={data} />
          <Text style={s.h2}>改善記錄（改善前 / 改善後）</Text>
          {data.improvements.map((im, i) => (
            <View key={i} wrap={false} style={s.impBlock}>
              <Text style={s.impDesc}>
                {im.seq}.({mmdd(im.date)}) {im.description}
                {im.areaName ? `「${im.areaName}」` : ''}
                {im.unitNames.length ? ` - 「${im.unitNames.join('、')}」` : ''}
              </Text>
              <View style={s.impPair}>
                <View style={s.impCell}>
                  <View style={s.photoInner}>
                    {im.before[0]?.src ? <Image style={s.photo} src={im.before[0].src} /> : <Text style={s.impEmpty}>（無）</Text>}
                    <Text style={s.impTag}>改善前</Text>
                  </View>
                </View>
                <View style={s.impCell}>
                  <View style={s.photoInner}>
                    {im.after[0]?.src ? <Image style={s.photo} src={im.after[0].src} /> : <Text style={s.impEmpty}>（無）</Text>}
                    <Text style={s.impTag}>改善後</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
          <Text style={s.formCode}>{data.formCode}</Text>
        </Page>
      )}
    </Document>
  );
}
