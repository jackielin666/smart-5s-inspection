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
  // 簽核區：三欄平均分配、留高度給簽名
  signRow: { flexDirection: 'row', marginTop: 20 },
  signCell: { flex: 1, paddingHorizontal: 10 },
  signLabel: { fontSize: 10, textAlign: 'center', marginBottom: 4 },
  signSpace: { height: 34, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 2 },
  signName: { fontSize: 9, textAlign: 'center' },
  signUnderline: { borderTopWidth: 1, borderColor: BORDER, marginTop: 2 },
  h2: { fontSize: 12, textAlign: 'center', marginVertical: 6, fontWeight: 'bold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoBox: { width: '50%', height: 248, padding: 4 },
  photoInner: { flex: 1, borderWidth: 1, borderColor: '#999', position: 'relative' },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  photoCaption: { position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#000' },
  // 改善記錄
  impRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  impCol: { flex: 1, padding: 4 },
  impColBorder: { borderRightWidth: 1, borderColor: BORDER },
  impLabel: { textAlign: 'center', fontWeight: 'bold', marginBottom: 3, fontSize: 9 },
  impImg: { width: '100%', height: 150, objectFit: 'cover' },
  impDesc: { marginBottom: 3, fontWeight: 'bold' },
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
  // 標號與第2頁一致：同一日期群組內的流水號（1. 2. 3.…）
  const openPhotos = data.notesByDate.flatMap((grp) =>
    grp.items.flatMap((it, i) =>
      it.status === 'resolved'
        ? []
        : it.photos
            .filter((p) => p.kind === 'before')
            .map((p) => ({ src: p.src, label: `${mmdd(grp.date)}-${i + 1}`, desc: it.description })),
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
                {grp.items.map((it, i) => (
                  <Text key={i} style={s.noteItem}>
                    {i + 1}. {it.description}
                    {it.areaName ? `（${it.areaName}）` : ''}
                    {it.unitNames.length ? ` - ${it.unitNames.join('、')}` : ''}
                  </Text>
                ))}
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
                <View style={s.photoInner}>
                  {p.src ? <Image style={s.photo} src={p.src} /> : null}
                  <Text style={s.photoCaption}>{p.label}</Text>
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
            <View key={i} wrap={false}>
              <Text style={s.impDesc}>
                {im.seq}.({mmdd(im.date)}) {im.description}
              </Text>
              <View style={s.impRow}>
                <View style={[s.impCol, s.impColBorder]}>
                  <Text style={s.impLabel}>改善前</Text>
                  {im.before[0]?.src ? <Image style={s.impImg} src={im.before[0].src} /> : <Text>（無）</Text>}
                </View>
                <View style={s.impCol}>
                  <Text style={s.impLabel}>改善後</Text>
                  {im.after[0]?.src ? <Image style={s.impImg} src={im.after[0].src} /> : <Text>（無）</Text>}
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
