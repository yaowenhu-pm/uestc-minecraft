#!/usr/bin/env python3
"""从 OSM 数据生成 BlueMap 的 POI 文字标注（marker-sets 配置块）。

用法：
  1. 用 Overpass API 拉取范围内带 name 的建筑（out tags center），存为 buildings.json
  2. python3 gen_markers.py buildings.json > markers.conf
  3. 把 markers.conf 内容替换进 BlueMap 的 config/maps/overworld.conf 的 marker-sets 块
  4. 重跑一次 bluemap-cli -r，标注即出现在网页上

经纬度 → Minecraft 坐标换算依赖 arnis 的 local 投影：
x 轴对应经度（西→东 0→W），z 轴对应纬度（北→南 0→H），
四至与宽高从存档目录的 metadata.json 读取。
"""
import json
import sys

# 与 arnis 生成时的 bbox 和 metadata.json 保持一致
MIN_LAT, MAX_LAT = 30.744, 30.7624
MIN_LON, MAX_LON = 103.918, 103.9386
W, H = 1968, 2045

# 名字含这些关键词的算主要地标，远距离常显；其余飞近才显示
LANDMARKS = ('图书馆', '品学楼', '主楼', '体育馆', '游泳馆', '会堂',
             '博物馆', '活动中心', '银杏苑', '荟文楼', '宣邦楼')

STYLE = ("background:rgba(0,0,0,0.65);color:#fff;padding:2px 7px;"
         "border-radius:4px;font-size:13px;white-space:nowrap;"
         "transform:translate(-50%,-50%);font-family:sans-serif")


def to_mc(lat, lon):
    x = (lon - MIN_LON) / (MAX_LON - MIN_LON) * W
    z = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * H
    return round(x), round(z)


def main(path):
    data = json.load(open(path))
    pois, seen = [], set()
    for e in data['elements']:
        name = e.get('tags', {}).get('name')
        c = e.get('center') or {'lat': e.get('lat'), 'lon': e.get('lon')}
        if not name or name in seen or not c.get('lat'):
            continue
        seen.add(name)
        pois.append((name, *to_mc(c['lat'], c['lon'])))

    print('marker-sets: {')
    print('  campus: {')
    print('    label: "校园地点"')
    print('    toggleable: true')
    print('    default-hidden: false')
    print('    sorting: 0')
    print('    markers: {')
    for i, (name, x, z) in enumerate(pois):
        label = name.replace('"', '')
        maxd = 2600 if any(k in name for k in LANDMARKS) else 550
        print(f'      p{i}: {{ type: "html", position: {{ x: {x}, y: 78, z: {z} }}, '
              f'label: "{label}", html: "<div style=\\"{STYLE}\\">{label}</div>", '
              f'max-distance: {maxd} }}')
    print('    }')
    print('  }')
    print('}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'buildings.json')
