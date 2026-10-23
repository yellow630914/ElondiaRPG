import { useContent } from '@/stores/content';
/** 測試用：建立一個可以修改的世界並切過去（原版世界不能改） */
export function editableWorld() {
    const c = useContent();
    c.switchWorld(c.createWorld('測試世界'));
    return c;
}
