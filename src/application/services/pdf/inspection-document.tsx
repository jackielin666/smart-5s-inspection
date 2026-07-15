import React from 'react';
import path from 'node:path';
import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { InspectionPdfData } from './inspection-pdf-data';

Font.register({
  family: 'NotoTC',
  src: path.join(process.cwd(), 'public/fonts/NotoSansTC-Regular.otf'),
});

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 32, fontFamily: 'NotoTC', fontSize: 9, color: '#000' },
  company: { fontSize: 16, textAlign: 'center', fontWeight: 'bold' },
  title: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  metaRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#000' },
  metaCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderColor: '#000' },
  legend: { borderWidth: 1, borderTopWidth: 0, borderColor: '#000', paddingVertical: 3, paddingHorizontal: 6 },
  tHead: { flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#000', backgroundColor: '#f0f0f0' },
  row: { flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#000' },
  cat: { width: 22, borderRightWidth: 1, borderColor: '#000', alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  catText: { fontSize: 9 },
  itemCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 5, borderRightWidth: 1, borderColor: '#000' },
  resCell: { width: 42, alignItems: 'center', justifyContent: 'center' },
  formCode: { position: 'absolute', bottom: 14, right: 32, fontSize: 9 },
  h2: { fontSize: 12, textAlign: 'center', marginBottom: 6 },
  noteDate: { fontWeight: 'bold', marginTop: 6, marginBottom: 2 },
  noteItem: { marginBottom: 2, paddingLeft: 8 },
  signRow: { flexDirection: 'row', marginTop: 18, gap: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoBox: { width: '50%', height: 250, padding: 4 },
  photoInner: { flex: 1, borderWidth: 1, borderColor: '#999', position: 'relative' },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  photoCaption: { position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#000' },
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
  const photos = data.photos.flatMap((def) =>
    def.photos.map((p) => ({ ...p, seq: def.seq, date: def.inspectionDate, desc: def.description })),
  );
  // 每頁 6 張（2×3）
  const photoPages: (typeof photos)[] = [];
  for (let i = 0; i < photos.length; i += 6) photoPages.push(photos.slice(i, i + 6));

  const mmdd = (iso: string) => iso.slice(5).replace('-', '/');

  return (
    <Document>
      {/* 第 1 頁：檢查表 */}
      <Page size="A4" style={s.page}>
        <Header d={data} />
        <View style={s.metaRow}>
          <View style={s.metaCell}>
            <Text>日 期 ︰ {data.rocDate}</Text>
          </View>
          <View style={[s.metaCell, { borderRightWidth: 0 }]}>
            <Text>區域位置： {data.area}</Text>
          </View>
        </View>
        <View style={s.legend}>
          <Text>{data.legend}</Text>
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

        {data.sections.map((sec) => (
          <View key={sec.name} style={{ flexDirection: 'row' }}>
            <CatLabel name={sec.name.replace(/[、，]/g, '')} />
            <View style={{ flex: 1 }}>
              {sec.items.map((it) => (
                <View key={it.itemNo} style={[s.row, { borderLeftWidth: 0 }]}>
                  <View style={s.itemCell}>
                    <Text>
                      {it.itemNo}. {it.content}
                    </Text>
                  </View>
                  <View style={s.resCell}>
                    <Text>{it.symbol}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={s.formCode}>{data.formCode}</Text>
      </Page>

      {/* 第 2 頁：狀況說明 */}
      <Page size="A4" style={s.page}>
        <Header d={data} />
        <Text style={s.h2}>狀況說明</Text>
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
        <View style={s.signRow}>
          <Text>廠長︰</Text>
          <Text>衛生管理人員︰</Text>
          <Text>檢查人員︰{data.inspectors.join('/')}</Text>
        </View>
        <Text style={s.formCode}>{data.formCode}</Text>
      </Page>

      {/* 第 3 頁起：缺失照片 2×3 */}
      {photoPages.map((pg, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          <Header d={data} />
          <View style={s.photoGrid}>
            {pg.map((p, i) => (
              <View key={i} style={s.photoBox}>
                <View style={s.photoInner}>
                  {p.src ? <Image style={s.photo} src={p.src} /> : null}
                  <Text style={s.photoCaption}>
                    {p.seq}.({mmdd(p.date)})
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={s.formCode}>{data.formCode}</Text>
        </Page>
      ))}
    </Document>
  );
}
