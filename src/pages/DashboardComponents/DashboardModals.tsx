import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronDown, Check, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Clock, ExternalLink, Play, Heart, MessageCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { Account, Video, ProductInfo } from '@/api';
import { SortKey, SortOrder } from '../Dashboard';

interface DashboardModalsProps {
  // Edit
  editAccount: Account | null; setEditAccount: (v: Account | null) => void;
  editCustomName: string; setEditCustomName: (v: string) => void;
  editGroupName: string; setEditGroupName: (v: string) => void;
  editCountry: string; setEditCountry: (v: string) => void;
  editMcn: string; setEditMcn: (v: string) => void;
  editCreatedAt: string; setEditCreatedAt: (v: string) => void;
  handleSaveAccountMeta: () => void;
  
  // Batch
  batchMetaModalOpen: boolean; setBatchMetaModalOpen: (v: boolean) => void;
  batchTargetGroup: string; setBatchTargetGroup: (v: string) => void;
  batchTargetCountry: string; setBatchTargetCountry: (v: string) => void;
  batchTargetMcn: string; setBatchTargetMcn: (v: string) => void;
  batchTargetCreatedAt: string; setBatchTargetCreatedAt: (v: string) => void;
  handleBatchUpdateMeta: () => void;
  selectedAccountIdsSize: number;

  // Add
  isAddAccountOpen: boolean; setIsAddAccountOpen: (v: boolean) => void;
  newAccountUrl: string; setNewAccountUrl: (v: string) => void;
  addingAccount: boolean; handleAddAccount: () => void;

  // Video List
  videoListModal: any; setVideoListModal: (v: any) => void;
  sortedModalVideos: Video[];
  modalSortKey: SortKey; setModalSortKey: (v: SortKey) => void;
  modalSortOrder: SortOrder; setModalSortOrder: (v: SortOrder) => void;
  sortOptions: { label: string; key: SortKey }[];
  productLoading: boolean; productInfo: ProductInfo | null;
  currentImgIndex: number; setCurrentImgIndex: React.Dispatch<React.SetStateAction<number>>;
  activePid: string; copyPid: (pid?: string) => void;
  
  // Image Fullscreen
  isImageFullScreen: boolean; setIsImageFullScreen: (v: boolean) => void;
}

export default function DashboardModals({
  editAccount, setEditAccount, editCustomName, setEditCustomName, editGroupName, setEditGroupName, editCountry, setEditCountry, 
  editMcn, setEditMcn, editCreatedAt, setEditCreatedAt, handleSaveAccountMeta,
  batchMetaModalOpen, setBatchMetaModalOpen, batchTargetGroup, setBatchTargetGroup, batchTargetCountry, setBatchTargetCountry,
  batchTargetMcn, setBatchTargetMcn, batchTargetCreatedAt, setBatchTargetCreatedAt, handleBatchUpdateMeta, selectedAccountIdsSize,
  isAddAccountOpen, setIsAddAccountOpen, newAccountUrl, setNewAccountUrl, addingAccount, handleAddAccount,
  videoListModal, setVideoListModal, sortedModalVideos, modalSortKey, setModalSortKey, modalSortOrder, setModalSortOrder, sortOptions,
  productLoading, productInfo, currentImgIndex, setCurrentImgIndex, activePid, copyPid,
  isImageFullScreen, setIsImageFullScreen
}: DashboardModalsProps) {

  return (
    <>
      {/* 1. 编辑账号信息弹窗 */}
      <Dialog open={!!editAccount} onOpenChange={(open) => { if (!open) setEditAccount(null); }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>编辑账号信息</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">自定义重命名</label>
              <Input placeholder="输入自定义名称" value={editCustomName} onChange={e => setEditCustomName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">所属分组</label>
              <Input placeholder="例如: 核心组、竞品组等" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">所在国家</label>
              <Input placeholder="例如: 美国、英国等" value={editCountry} onChange={e => setEditCountry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">机构名称</label>
              <Input placeholder="输入机构名称" value={editMcn} onChange={e => setEditMcn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">录入系统时间</label>
              <Input placeholder="例如: 2023-10-01 12:00:00" value={editCreatedAt} onChange={e => setEditCreatedAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)}>取消</Button>
            <Button onClick={handleSaveAccountMeta} className="bg-indigo-600 hover:bg-indigo-700">保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. 批量更新属性弹窗 */}
      <Dialog open={batchMetaModalOpen} onOpenChange={setBatchMetaModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
           <DialogHeader><DialogTitle>批量修改账号属性</DialogTitle></DialogHeader>
           <div className="py-4 space-y-4">
              <p className="text-sm text-slate-500">正在为选中的 {selectedAccountIdsSize} 个账号执行批量修改，留空的项不会被更改。</p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">统一修改分组</label>
                <Input placeholder="输入目标分组名，不修改请留空" value={batchTargetGroup} onChange={e => setBatchTargetGroup(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">统一修改国家</label>
                <Input placeholder="输入国家，不修改请留空" value={batchTargetCountry} onChange={e => setBatchTargetCountry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">统一修改机构(MCN)</label>
                <Input placeholder="输入机构名，不修改请留空" value={batchTargetMcn} onChange={e => setBatchTargetMcn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">统一修改录入时间</label>
                <Input placeholder="例如: 2023-10-01 12:00:00，不修改请留空" value={batchTargetCreatedAt} onChange={e => setBatchTargetCreatedAt(e.target.value)} />
              </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setBatchMetaModalOpen(false)}>取消</Button>
             <Button onClick={handleBatchUpdateMeta} className="bg-indigo-600 hover:bg-indigo-700">确定修改</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. 录入监测账号弹窗 */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>录入 TikTok 监测账号</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">账号主页链接 或 用户名 <span className="text-slate-400 font-normal">(一行一个，支持批量)</span></label>
              <textarea 
                placeholder="例如:&#10;tiktok.com/@user1&#10;username2" 
                value={newAccountUrl} 
                onChange={(e) => setNewAccountUrl(e.target.value)} 
                className="w-full min-h-[120px] rounded-md border border-slate-300 p-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
              />
              <p className="text-xs text-slate-500">添加后大盘卡片将自动在后台开启状态捕获。分组和国家稍后可在卡片上点击编辑进行配置。录入时间将自动记录为当前时间。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>取消</Button>
            <Button onClick={handleAddAccount} disabled={addingAccount} className="bg-indigo-600 hover:bg-indigo-700">
              {addingAccount ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行队列中...</> : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. 视频列表与PID详情弹窗 */}
      <Dialog open={!!videoListModal} onOpenChange={(open) => { if (!open) setVideoListModal(null); }}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh] overflow-y-auto bg-slate-50">
           <DialogHeader>
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8 pb-3 border-b border-slate-200/60">
                <DialogTitle className="text-xl pt-1 text-slate-800">
                  {videoListModal?.title} 
                  {!videoListModal?.loading && (
                    <span className="text-sm font-normal text-slate-500 ml-2">
                       (已关联 {sortedModalVideos.length} 个视频，属于 <strong className="text-indigo-600 px-1">{new Set(sortedModalVideos.map(v => v.account_id)).size}</strong> 个不同作者)
                    </span>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 h-8 text-xs bg-white">{sortOptions.find(o => o.key === modalSortKey)?.label}<ChevronDown size={14} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {sortOptions.map((option) => (
                        <DropdownMenuItem key={option.key} onClick={() => setModalSortKey(option.key)}>
                          <span className={modalSortKey === option.key ? 'text-indigo-600 font-medium' : ''}>{option.label}</span>
                          {modalSortKey === option.key && <Check size={14} className="ml-auto text-indigo-600" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => setModalSortOrder(modalSortOrder === 'asc' ? 'desc' : 'asc')}>
                    {modalSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </Button>
                </div>
             </div>
          </DialogHeader>

          {videoListModal?.loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-4">
               <Loader2 className="animate-spin w-10 h-10 text-indigo-500" />
               <span className="font-medium tracking-wider">正在飞速调取庞大的矩阵数据网络，请稍候...</span>
            </div>
          ) : (
            <>
              {productLoading ? (
                <div className="flex justify-center items-center py-6 border border-slate-200 bg-white rounded-xl mb-4 shadow-sm">
                   <Loader2 className="animate-spin text-indigo-500 w-6 h-6" />
                   <span className="ml-3 text-sm text-slate-500 font-medium tracking-wide">正在连接服务端穿透爬取带货链接情报...</span>
                </div>
              ) : productInfo ? (
                <div className="bg-white p-5 rounded-xl border border-slate-200 mb-2 flex flex-col md:flex-row gap-6 shadow-sm">
                  <div className="w-full md:w-[240px] shrink-0 relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
                    {productInfo.images && productInfo.images.length > 0 ? (
                      <>
                        <img 
                          src={productInfo.images[currentImgIndex]} 
                          className="w-full h-full object-cover transition-all cursor-pointer hover:opacity-90 hover:scale-105" 
                          referrerPolicy="no-referrer" 
                          alt="商品" 
                          onClick={(e) => { e.stopPropagation(); setIsImageFullScreen(true); }}
                          title="点击放大预览图"
                        />
                        {productInfo.images.length > 1 && (
                          <>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentImgIndex(prev => prev === 0 ? productInfo.images.length - 1 : prev - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-opacity z-50"><ChevronLeft size={16}/></button>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentImgIndex(prev => prev === productInfo.images.length - 1 ? 0 : prev + 1); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-opacity z-50"><ChevronRight size={16}/></button>
                            <div className="absolute bottom-2 left-1/2 -translate-y-1/2 bg-black/60 text-white text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-sm z-40">{currentImgIndex + 1} / {productInfo.images.length}</div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">暂无图片</div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-base font-bold text-slate-900 mb-4">{productInfo.introduction}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-[13px]">
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">商品 PID</span><span className="font-semibold text-slate-800 break-all">{activePid}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">品牌名称</span><span className="font-semibold text-slate-800 break-all">{productInfo.brand}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4 md:col-span-2"><span className="text-slate-500 shrink-0 w-16">详细类目</span><span className="font-semibold text-slate-800 break-all">{productInfo.category}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">国家地区</span><span className="font-semibold text-slate-800 break-all">{productInfo.country}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">当前价格</span><span className="font-bold text-red-600 break-all">{productInfo.price}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">商品评分</span><span className="font-semibold text-orange-500 break-all">{productInfo.product_rating}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">佣金率</span><span className="font-semibold text-emerald-600 break-all">{productInfo.commission_rate}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">总销量</span><span className="font-semibold text-slate-800 break-all">{productInfo.sold_count}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">总 G M V</span><span className="font-bold text-red-600 break-all">{productInfo.sale_amount}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">带货达人</span><span className="font-semibold text-slate-800 break-all">{productInfo.author_count}</span></div>
                      <div className="flex border-b border-slate-100 pb-1.5 gap-4"><span className="text-slate-500 shrink-0 w-16">视频数量</span><span className="font-semibold text-slate-800 break-all">{productInfo.aweme_count}</span></div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 mt-2">
                {sortedModalVideos?.map((video) => (
                  <div key={video.id + (video.pid || "")} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 hover:shadow-md transition-shadow duration-300">
                    <div className="w-full md:w-32 shrink-0 aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden relative">
                      {video.cover_url && <img src={video.cover_url} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-bold">@{video.username || '未收录作者'}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{video.platform_category || '无类目'}</span>
                          {video.pid && (
                            <span onClick={() => copyPid(video.pid)} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full cursor-pointer hover:bg-red-100 transition-colors" title="点击复制PID">复制 PID: {video.pid}</span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{video.desc || '无描述'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock size={12} /><span>{format(new Date((video.create_time||0) * 1000), 'yyyy-MM-dd HH:mm')}</span>
                          <a href={video.url || `https://www.tiktok.com/@${video.username}/video/${video.video_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600"><ExternalLink size={12} />看原视频</a>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                        <div className="flex items-center gap-1"><Play size={12} /> {video.play_count?.toLocaleString()}</div>
                        <div className="flex items-center gap-1"><Heart size={12} /> {video.digg_count?.toLocaleString()}</div>
                        <div className="flex items-center gap-1"><MessageCircle size={12} /> {video.comment_count?.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 5. 全屏图片放大查看器 */}
      {isImageFullScreen && productInfo && productInfo.images.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setIsImageFullScreen(false)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-[110]" onClick={() => setIsImageFullScreen(false)}>
            <X size={32} />
          </button>
          
          <img 
            src={productInfo.images[currentImgIndex]} 
            className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200" 
            referrerPolicy="no-referrer" 
            alt="Fullscreen preview" 
            onClick={(e) => e.stopPropagation()} 
          />
          
          {productInfo.images.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentImgIndex(prev => prev === 0 ? productInfo.images.length - 1 : prev - 1); }} 
                className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-4 rounded-full transition-colors z-[110]"
              >
                <ChevronLeft size={32}/>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentImgIndex(prev => prev === productInfo.images.length - 1 ? 0 : prev + 1); }} 
                className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-4 rounded-full transition-colors z-[110]"
              >
                <ChevronRight size={32}/>
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full tracking-widest z-[110]">
                {currentImgIndex + 1} / {productInfo.images.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}