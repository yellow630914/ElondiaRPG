import sys; sys.path.insert(0,'worldgen/scripts/elondia')
from ed import ed
ed('src/components/ImageSettings.vue',[
("<label>額外參數（JSON，選填；{{ image.service === 'novelai' ? '合併進 parameters' : '合併進請求' }}）\n",
 "<label><span>額外參數（JSON，選填） <Hint :text=\"image.service === 'novelai' ? '合併進 parameters。' : '合併進請求。'\" /></span>\n"),
("<label>指示（交給大語言模型的 system）\n","<label><span>指示 <Hint text=\"當作 system 交給大語言模型。\" /></span>\n"),
("的指示（內建，不能修改；複製成自訂的再改）</summary>","的指示 <Hint text=\"內建，不能修改；複製成自訂的再改。\" /></summary>"),
("<label>畫風（模板的 {style}） <input","<label><span>畫風 <Hint text=\"填進提示詞模板的 {style}。\" /></span><input"),
])
