import { useEffect, useState } from 'react';
import { api } from '@/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';

export function Settings() {
  const [time, setTime] = useState('08:00');
  const [internalScrapeLimit, setInternalScrapeLimit] = useState(30);
  const [externalScrapeLimit, setExternalScrapeLimit] = useState(30);
  
  const [deepseekApiKey, setDeepseekApiKey] = useState('');

  const [warnNormalPlay, setWarnNormalPlay] = useState(8000);
  const [warnNormalHigh, setWarnNormalHigh] = useState(20000);
  const [warnGrowthPlay, setWarnGrowthPlay] = useState(1000);
  const [warnGrowthHigh, setWarnGrowthHigh] = useState(3000);
  const [warnLowDays, setWarnLowDays] = useState(2);
  const [warnLowPlay, setWarnLowPlay] = useState(100);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.getSettings();
        setTime(res.schedule_time || '08:00');
        setInternalScrapeLimit(parseInt(res.internal_scrape_video_limit || '30'));
        setExternalScrapeLimit(parseInt(res.external_scrape_video_limit || '30'));
        setDeepseekApiKey(res.deepseek_api_key || ''); 
        
        setWarnNormalPlay(parseInt(res.warning_normal_play || '8000'));
        setWarnNormalHigh(parseInt(res.warning_normal_high || '20000'));
        setWarnGrowthPlay(parseInt(res.warning_growth_play || '1000'));
        setWarnGrowthHigh(parseInt(res.warning_growth_high || '3000'));
        setWarnLowDays(parseInt(res.warning_low_days || '2'));
        setWarnLowPlay(parseInt(res.warning_low_play || '100'));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveTime = async () => {
    setSavingTime(true);
    try {
      await api.saveSettings({ schedule_time: time });
      alert('排程自动化时间设置已保存');
    } catch (error: any) {
      alert('保存失败');
    } finally {
      setSavingTime(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSettings({
        internal_scrape_video_limit: internalScrapeLimit.toString(),
        external_scrape_video_limit: externalScrapeLimit.toString(),
        warning_normal_play: warnNormalPlay.toString(),
        warning_normal_high: warnNormalHigh.toString(),
        warning_growth_play: warnGrowthPlay.toString(),
        warning_growth_high: warnGrowthHigh.toString(),
        warning_low_days: warnLowDays.toString(),
        warning_low_play: warnLowPlay.toString(),
        deepseek_api_key: deepseekApiKey, 
      });
      alert('系统全局设置已保存');
    } catch (error: any) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleForceUpdateAll = async () => {
    if(!window.confirm("确定要立即触发后台线程抓取全库所有活跃账号吗？此操作将消耗较大网络资源。")) return;
    setUpdatingAll(true);
    try {
      await api.forceUpdateAll();
      alert("全局更新指令已成功下发至后台排队处理！你可以去监控面板查看各账号进度。");
    } catch (error) {
      alert("指令下发失败");
    } finally {
      setUpdatingAll(false);
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-6">
         <h2 className="text-2xl font-bold">系统设置</h2>
         <Button onClick={handleForceUpdateAll} disabled={updatingAll} className="bg-slate-800 hover:bg-slate-900 text-white">
            {updatingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            一键全库账号强制更新
         </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>全局自动轮询排程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="schedule">系统每日在后台自动运行无头并发更新时间点</Label>
            <div className="flex gap-4 items-center mt-2">
              <Input id="schedule" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-auto min-w-[120px]" />
              <Button onClick={handleSaveTime} disabled={savingTime} size="sm">{savingTime ? '保存中...' : '保存执行时间'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50">
          <CardTitle className="text-indigo-800 flex items-center gap-2">
            AI 智能体配置 (DeepSeek)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label htmlFor="deepseekApiKey">DeepSeek API Key (Token)</Label>
            <Input 
              id="deepseekApiKey" 
              type="password" 
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx" 
              value={deepseekApiKey} 
              onChange={(e) => setDeepseekApiKey(e.target.value)} 
              className="font-mono"
            />
            <p className="text-xs text-slate-500">用于悬浮 AI 智能体的自然语言数据库查询及分析支撑。</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>抓取参数与策略配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="internalScrapeLimit">内部核心号 - 默认抓取视频截取限制数</Label>
            <Input id="internalScrapeLimit" type="number" min="1" max="100" value={internalScrapeLimit} onChange={(e) => setInternalScrapeLimit(parseInt(e.target.value) || 0)} className="w-40" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="externalScrapeLimit">外部侦测号 - 默认抓取视频截取限制数</Label>
            <Input id="externalScrapeLimit" type="number" min="1" max="100" value={externalScrapeLimit} onChange={(e) => setExternalScrapeLimit(parseInt(e.target.value) || 0)} className="w-40" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>预警中心阈值配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>正常预警播放量起点</Label>
              <Input type="number" value={warnNormalPlay} onChange={(e) => setWarnNormalPlay(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>正常预警高亮标红点 (流量激增)</Label>
              <Input type="number" value={warnNormalHigh} onChange={(e) => setWarnNormalHigh(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>日增长预警起点 (24小时新增)</Label>
              <Input type="number" value={warnGrowthPlay} onChange={(e) => setWarnGrowthPlay(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>日增长强提醒起点</Label>
              <Input type="number" value={warnGrowthHigh} onChange={(e) => setWarnGrowthHigh(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>低播预警判断天数</Label>
              <Input type="number" value={warnLowDays} onChange={(e) => setWarnLowDays(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>低播预警播放量阈值 (低于该值触发)</Label>
              <Input type="number" value={warnLowPlay} onChange={(e) => setWarnLowPlay(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-6">
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? '正在写入系统缓存...' : '保存所有设置'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}