<?php
// 处理预检OPTIONS请求，提前返回跨域头
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    // 兼容本地file://打开的null源，同时放行所有线上域名
    if ($origin === '' || $origin === 'null') {
        header('Access-Control-Allow-Origin: null');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type,X-Master-Key');
    header('Content-Type: application/json;charset=utf-8');
    http_response_code(200);
    exit(json_encode(['code'=>200,'msg'=>'ok']));
}

// 正常GET/POST请求跨域头设置
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === '' || $origin === 'null') {
    header('Access-Control-Allow-Origin: null');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,X-Master-Key');
header('Content-Type: application/json;charset=utf-8');

$BIN_ID = '6a2cd944f5f4af5e29ea421';
$MASTER_KEY = '$2a$10$7GsHtB0OyudQxlg4LS.jFedqV8GlJTjOfCWxjdASwyBT1iFjltEcy';
$BASE_URL = "https://api.jsonbin.io/v3/b/{$BIN_ID}";

// 修复：删除重复定义，只保留一次
function err($msg,$code=400){
    http_response_code($code);
    exit(json_encode(['status'=>'fail','msg'=>$msg,'data'=>[]]));
}
function suc($data,$msg="success"){
    exit(json_encode(['status'=>'success','msg'=>$msg,'data'=>$data,'time'=>date('Y-m-d H:i:s')]));
}

function binGet(){
    global $BASE_URL,$MASTER_KEY;
    $ch = curl_init("{$BASE_URL}/latest");
    curl_setopt_array($ch,[
        CURLOPT_HTTPHEADER=>["X-Master-Key: {$MASTER_KEY}","Accept: application/json"],
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_TIMEOUT=>30,
        CURLOPT_SSL_VERIFYPEER=>false
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if($err) err("curl错误：".$err);
    if($code !== 200) err("JSONBin接口错误 code:".$code." 内容：".$res);
    $json = json_decode($res,true);
    if(json_last_error()!==0) err("返回数据解析失败");
    return $json['record'] ?? ['users'=>[]];
}

function binPut($data){
    global $BASE_URL,$MASTER_KEY;
    $ch = curl_init($BASE_URL);
    curl_setopt_array($ch,[
        CURLOPT_CUSTOMREQUEST=>"PUT",
        // 修复：X-Master-Key 后加空格，格式统一
        CURLOPT_HTTPHEADER=>["Content-Type: application/json","X-Master-Key: {$MASTER_KEY}","Accept: application/json"],
        CURLOPT_POSTFIELDS=>json_encode($data),
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_TIMEOUT=>30,
        CURLOPT_SSL_VERIFYPEER=>false
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if($err) err("curl错误：".$err);
    if($code!==200 && $code!==201) err("保存失败 code:".$code);
    return json_decode($res,true);
}

$act = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$raw = file_get_contents('php://input');
$input = json_decode($raw,true) ?? [];

switch($act){
    case 'load':
        if($method!=='GET') err("仅允许GET");
        $d = binGet();
        suc($d);
        break;
    case 'save':
        if($method!=='POST') err("仅允许POST");
        binPut($input);
        suc($input,"已覆盖保存");
        break;
    case 'update':
        if($method!=='POST') err("仅允许POST");
        $old = binGet();
        // 修复：array_merge_recursive 改为 array_replace_recursive
        // 避免数组被递归合并（如 pass: [1,2] + pass: [3] 变成 [1,2,3] 而非 [3]）
        $new = array_replace_recursive($old,$input);
        binPut($new);
        suc($new,"合并更新成功");
        break;
    case 'clear':
        binPut(['users'=>[],"clear_time"=>date('Y-m-d H:i:s')]);
        suc([],"数据已清空");
        break;
    case 'info':
        $d = binGet();
        $size = strlen(json_encode($d));
        $info = [
            'total_keys'=>count($d),
            'user_count'=>isset($d['users'])?count($d['users']):0,
            'size_kb'=>round($size/1024,2),
            'size_mb'=>round($size/1024/1024,2)
        ];
        suc($info);
        break;
    case 'test':
        suc(['bin_id'=>$BIN_ID,'server_time'=>date('Y-m-d H:i:s')],"接口正常");
        break;
    default:
        err("未知action：".$act);
}
?>