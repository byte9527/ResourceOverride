import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Switch, 
  Button, 
  Typography, 
  Space, 
  Divider, 
  message,
  Tag,
  Row,
  Col,
  Tabs,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  SettingOutlined, 
  BugOutlined, 
  InfoCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  GlobalOutlined,
  DownloadOutlined,
  UploadOutlined,
  RightOutlined,
  CopyOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface Rule {
  id: string;
  on: boolean;
  type: 'fileOverride' | 'urlRedirect' | 'headerModification' | 'contentModification';
  from: string;
  to?: string;
  file?: string;
  fileType?: 'js' | 'css' | 'html';
  description?: string;
}

interface Domain {
  id: string;
  url: string;
  on: boolean;
  rules: Rule[];
  description?: string;
}

type RuleSource = 'global' | 'tab';

interface RuleContext {
  tabId?: number;
  source: RuleSource;
  privateRulesEnabled: boolean;
  hasPrivateDraft: boolean;
  domains: Domain[];
}

interface RuleStats {
  dynamicRules: number;
  sessionRules: number;
  activePrivateTabs: number;
  privateDraftTabs: number;
}

const pageParams = new URLSearchParams(window.location.search);
const parsedTabId = Number(pageParams.get('tabId'));
const isDevToolsContext = pageParams.get('source') === 'devtools' && Number.isInteger(parsedTabId);
const inspectedTabId = isDevToolsContext ? parsedTabId : undefined;

const OptionsApp: React.FC = () => {
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [version, setVersion] = useState<string>('');
  const [installDate, setInstallDate] = useState<string>('');
  const [updateDate, setUpdateDate] = useState<string>('');
  const [ruleStats, setRuleStats] = useState<RuleStats>({
    dynamicRules: 0,
    sessionRules: 0,
    activePrivateTabs: 0,
    privateDraftTabs: 0
  });
  const [ruleSource, setRuleSource] = useState<RuleSource>('global');
  const [privateRulesEnabled, setPrivateRulesEnabled] = useState(false);
  const [hasPrivateDraft, setHasPrivateDraft] = useState(false);
  const [scopeChanging, setScopeChanging] = useState(false);
  
  // 规则管理状态
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string>('');
  
  const [form] = Form.useForm();
  const [ruleForm] = Form.useForm();

  // 加载设置
  useEffect(() => {
    loadSettings();
    loadRuleStats();
    loadRuleContext();
  }, []);

  const applyRuleContext = (context: RuleContext): void => {
    setRuleSource(context.source);
    setPrivateRulesEnabled(context.privateRulesEnabled);
    setHasPrivateDraft(context.hasPrivateDraft);
    setDomains(context.domains || []);
  };

  const loadSettings = async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get([
        'showLogs', 'version', 'installDate', 'updateDate'
      ]);
      
      setShowLogs(result.showLogs === 'true');
      setVersion(result.version || '1.0.0');
      setInstallDate(result.installDate || '');
      setUpdateDate(result.updateDate || '');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleLogsChange = async (checked: boolean): Promise<void> => {
    try {
      await chrome.storage.local.set({ showLogs: checked.toString() });
      setShowLogs(checked);
      message.success(checked ? '调试日志已开启' : '调试日志已关闭');
    } catch (error) {
      console.error('Failed to save logs setting:', error);
      message.error('保存设置失败');
    }
  };

  const loadRuleStats = async (): Promise<void> => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getRuleStats' });
      if (response?.success) {
        setRuleStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load rule stats:', error);
    }
  };

  const clearCache = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      message.success('缓存已清理');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      message.error('清理缓存失败');
    }
  };

  const handleOpenExtensionManager = async (): Promise<void> => {
    try {
      await chrome.tabs.create({ url: 'chrome://extensions/' });
    } catch (error) {
      console.error('Failed to open extension manager:', error);
      message.error('无法打开扩展管理页面');
    }
  };

  // 导出规则
  const handleExportRules = (): void => {
    try {
      const exportData = {
        version: '1.3.2',
        exportTime: new Date().toISOString(),
        source: ruleSource,
        domains: domains
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `resource-override-rules-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success('规则导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('导出失败');
    }
  };

  // 导入规则
  const handleImportRules = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // 验证导入数据格式
        if (!importData.domains || !Array.isArray(importData.domains)) {
          throw new Error('Invalid import format');
        }

        // 显示确认对话框
        Modal.confirm({
          title: '确认导入规则',
          content: `确定要导入 ${importData.domains.length} 个域名的规则吗？这将覆盖当前${ruleSource === 'tab' ? '标签页私有' : '全局'}规则。`,
          okText: '导入',
          cancelText: '取消',
          onOk: async () => {
            try {
              // 为导入的规则生成新的ID（纯数字）
              const processedDomains = importData.domains.map((domain: any) => ({
                ...domain,
                id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
                rules: domain.rules.map((rule: any) => ({
                  ...rule,
                  id: (Date.now() + Math.floor(Math.random() * 1000)).toString()
                }))
              }));
              
              await saveDomains(processedDomains);
              message.success('规则导入成功');
            } catch (error) {
              console.error('Import save failed:', error);
              message.error('导入保存失败');
            }
          }
        });
      } catch (error) {
        console.error('Import failed:', error);
        message.error('导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  // 域名和规则管理函数
  const loadRuleContext = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getRuleContext',
        tabId: inspectedTabId
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to load rule context');
      }
      applyRuleContext(response.data);
    } catch (error) {
      console.error('Failed to load rule context:', error);
      message.error('加载域名失败');
    } finally {
      setLoading(false);
    }
  };

  const saveDomains = async (newDomains: Domain[]): Promise<void> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveRuleContext',
        source: ruleSource,
        tabId: inspectedTabId,
        domains: newDomains
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save rules');
      }
      applyRuleContext(response.data);
      await loadRuleStats();
      message.success('保存成功，刷新页面后完整生效');
    } catch (error) {
      console.error('Failed to save domains:', error);
      message.error('保存失败');
      throw error;
    }
  };

  const changePrivateRulesEnabled = async (enabled: boolean): Promise<void> => {
    if (inspectedTabId === undefined) return;

    const execute = async (): Promise<void> => {
      setScopeChanging(true);
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'setTabRulesEnabled',
          tabId: inspectedTabId,
          enabled
        });
        if (!response?.success) {
          throw new Error(response?.error || 'Failed to change rule scope');
        }
        setModalVisible(false);
        setRuleModalVisible(false);
        form.resetFields();
        ruleForm.resetFields();
        applyRuleContext(response.data);
        await loadRuleStats();
        message.success(enabled
          ? '已启用当前标签页独立规则'
          : '已恢复使用最新全局规则，私有规则草稿已保留');
      } catch (error) {
        console.error('Failed to change private rule state:', error);
        message.error('切换规则范围失败');
      } finally {
        setScopeChanging(false);
      }
    };

    if (modalVisible || ruleModalVisible) {
      Modal.confirm({
        title: '确认切换规则范围',
        content: '当前编辑窗口中的未保存内容将被丢弃，是否继续？',
        okText: '继续切换',
        cancelText: '取消',
        onOk: execute
      });
      return;
    }

    await execute();
  };

  const resetPrivateRules = async (): Promise<void> => {
    if (inspectedTabId === undefined) return;
    setScopeChanging(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'resetTabRulesFromGlobal',
        tabId: inspectedTabId
      });
      if (!response?.success) throw new Error(response?.error || 'Reset failed');
      applyRuleContext(response.data);
      await loadRuleStats();
      message.success('已重置为最新全局规则，刷新页面后完整生效');
    } catch (error) {
      console.error('Failed to reset private rules:', error);
      message.error('重置私有规则失败');
    } finally {
      setScopeChanging(false);
    }
  };

  const discardPrivateDraft = async (): Promise<void> => {
    if (inspectedTabId === undefined) return;
    setScopeChanging(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'discardTabRuleDraft',
        tabId: inspectedTabId
      });
      if (!response?.success) throw new Error(response?.error || 'Discard failed');
      applyRuleContext(response.data);
      await loadRuleStats();
      message.success('已丢弃当前标签页的私有规则草稿');
    } catch (error) {
      console.error('Failed to discard private draft:', error);
      message.error('丢弃私有草稿失败');
    } finally {
      setScopeChanging(false);
    }
  };

  const refreshInspectedTab = async (): Promise<void> => {
    if (inspectedTabId === undefined) return;
    try {
      await chrome.tabs.reload(inspectedTabId);
      message.success('当前页面已刷新');
    } catch (error) {
      console.error('Failed to reload inspected tab:', error);
      message.error('刷新当前页面失败');
    }
  };

  const toggleDomain = async (domainId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? { ...domain, on: !domain.on }
        : domain
    );
    await saveDomains(newDomains);
  };

  const toggleRule = async (domainId: string, ruleId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? {
            ...domain,
            rules: domain.rules.map(rule =>
              rule.id === ruleId ? { ...rule, on: !rule.on } : rule
            )
          }
        : domain
    );
    await saveDomains(newDomains);
  };

  const deleteDomain = async (domainId: string): Promise<void> => {
    const newDomains = domains.filter(domain => domain.id !== domainId);
    await saveDomains(newDomains);
  };

  const deleteRule = async (domainId: string, ruleId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? {
            ...domain,
            rules: domain.rules.filter(rule => rule.id !== ruleId)
          }
        : domain
    );
    await saveDomains(newDomains);
  };

  // 复制域名组（包含其下所有规则）
  const duplicateDomain = async (domainId: string): Promise<void> => {
    const source = domains.find(d => d.id === domainId);
    if (!source) return;
    const newDomainId = (Date.now() + Math.floor(Math.random() * 1000)).toString();
    const copiedRules = (source.rules || []).map(rule => ({
      ...rule,
      id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
    }));
    const copiedDomain: Domain = {
      ...source,
      id: newDomainId,
      rules: copiedRules,
    };
    const newDomains = [...domains, copiedDomain];
    await saveDomains(newDomains);
    message.success('已复制域名组');
  };

  // 复制单条规则
  const duplicateRule = async (domainId: string, ruleId: string): Promise<void> => {
    const newDomains = domains.map(domain => {
      if (domain.id !== domainId) return domain;
      const rule = domain.rules.find(r => r.id === ruleId);
      if (!rule) return domain;
      const copiedRule: Rule = {
        ...rule,
        id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
      };
      return {
        ...domain,
        rules: [...domain.rules, copiedRule],
      };
    });
    await saveDomains(newDomains);
    message.success('已复制规则');
  };

  const openDomainModal = (domain?: Domain): void => {
    setEditingDomain(domain || null);
    if (domain) {
      form.setFieldsValue(domain);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const openRuleModal = (domainId: string, rule?: Rule): void => {
    setCurrentDomainId(domainId);
    setEditingRule(rule || null);
    if (rule) {
      ruleForm.setFieldsValue(rule);
    } else {
      ruleForm.resetFields();
    }
    setRuleModalVisible(true);
  };

  const handleDomainSubmit = async (values: any): Promise<void> => {
    try {
      if (editingDomain) {
        const newDomains = domains.map(domain =>
          domain.id === editingDomain.id
            ? { ...domain, ...values }
            : domain
        );
        await saveDomains(newDomains);
      } else {
        const newDomain: Domain = {
          id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
          ...values,
          rules: []
        };
        await saveDomains([...domains, newDomain]);
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('保存域名失败');
    }
  };

  const handleRuleSubmit = async (values: any): Promise<void> => {
    try {
      const newRule: Rule = {
        id: editingRule?.id || (Date.now() + Math.floor(Math.random() * 1000)).toString(),
        ...values
      };

      const newDomains = domains.map(domain =>
        domain.id === currentDomainId
          ? {
              ...domain,
              rules: editingRule
                ? domain.rules.map(rule => rule.id === editingRule.id ? newRule : rule)
                : [...domain.rules, newRule]
            }
          : domain
      );
      
      await saveDomains(newDomains);
      setRuleModalVisible(false);
      ruleForm.resetFields();
    } catch (error) {
      message.error('保存规则失败');
    }
  };

  // 表格列定义
  const domainColumns = [
    {
      title: '状态',
      dataIndex: 'on',
      key: 'on',
      width: 80,
      render: (on: boolean, record: Domain) => (
        <Switch
          checked={on}
          onChange={() => toggleDomain(record.id)}
          checkedChildren={<PlayCircleOutlined />}
          unCheckedChildren={<PauseCircleOutlined />}
        />
      ),
    },
    {
      title: '域名/URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '规则数量',
      dataIndex: 'rules',
      key: 'ruleCount',
      width: 100,
      render: (rules: Rule[]) => (
        <Tag color={rules.length > 0 ? 'blue' : 'default'}>
          {rules.length} 条
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description: string) => description || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Domain) => (
        <Space>
          <Tooltip title="编辑域名">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openDomainModal(record)}
            />
          </Tooltip>
          <Tooltip title="复制域名组">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => duplicateDomain(record.id)}
            />
          </Tooltip>
          <Tooltip title="添加规则">
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => openRuleModal(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此域名？"
            onConfirm={() => deleteDomain(record.id)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (domain: Domain) => {
    const ruleColumns = [
      {
        title: '状态',
        dataIndex: 'on',
        key: 'on',
        width: 60,
        render: (on: boolean, rule: Rule) => (
          <Switch
            size="small"
            checked={on}
            onChange={() => toggleRule(domain.id, rule.id)}
          />
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 120,
        render: (type: string) => {
          const typeMap: Record<string, { color: string; text: string }> = {
            urlRedirect: { color: 'blue', text: 'URL重定向' },
            fileOverride: { color: 'green', text: '文件替换' },
            headerModification: { color: 'orange', text: '头部修改' },
            // contentModification: { color: 'purple', text: '内容修改' },
          };
          const config = typeMap[type] || { color: 'default', text: type };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '匹配规则',
        dataIndex: 'from',
        key: 'from',
        ellipsis: true,
      },
      {
        title: '目标',
        dataIndex: 'to',
        key: 'to',
        ellipsis: true,
        render: (to: string, rule: Rule) => to || rule.file || '-',
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (description: string) => description || '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        render: (_: any, rule: Rule) => (
          <Space>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openRuleModal(domain.id, rule)}
            />
            <Tooltip title="复制规则">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => duplicateRule(domain.id, rule.id)}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除此规则？"
              onConfirm={() => deleteRule(domain.id, rule.id)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={ruleColumns}
        dataSource={domain.rules}
        pagination={false}
        size="small"
        rowKey="id"
        locale={{ emptyText: '暂无规则' }}
      />
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 头部 */}
        <Card>
          <Space align="center">
            <SettingOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>
                Resource Override 设置
              </Title>
              <Text type="secondary">管理扩展功能、规则和偏好设置</Text>
            </div>
          </Space>
        </Card>

        {/* 主要内容 */}
        <Card>
          <Tabs defaultActiveKey="rules" type="card">
            <TabPane tab="规则管理" key="rules">
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openDomainModal()}
                  >
                    添加域名
                  </Button>
                  <Tag color={ruleSource === 'tab' ? 'purple' : 'blue'}>
                    当前正在编辑：{ruleSource === 'tab' ? '此标签页的独立规则' : '全局规则'}
                  </Tag>
                </Space>
                <Space>
                  {isDevToolsContext && (
                    <Button onClick={refreshInspectedTab}>
                      刷新当前页面
                    </Button>
                  )}
                  <Button
                    icon={<UploadOutlined />}
                    onClick={handleImportRules}
                  >
                    导入规则
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExportRules}
                  >
                    导出规则
                  </Button>
                </Space>
              </div>
              <Table
                columns={domainColumns}
                dataSource={domains}
                loading={loading}
                rowKey="id"
                expandable={{
                  expandedRowRender,
                  expandIcon: ({ expanded, onExpand, record }) => (
                    <Button
                      type="text"
                      size="small"
                      icon={<RightOutlined />}
                      onClick={e => onExpand(record, e)}
                      style={{ 
                        transform: expanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  ),
                }}
                locale={{ emptyText: '暂无域名规则，点击"添加域名"开始配置' }}
              />
            </TabPane>
            
            <TabPane tab="基本设置" key="settings">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Card title="功能设置" size="small">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space direction="vertical" size={0}>
                          <Text strong>当前标签页使用独立规则</Text>
                          <Text type="secondary">
                            开启后，当前标签页将使用独立规则副本，规则编辑不会影响其他标签页。关闭后，当前标签页会立即恢复使用最新全局规则，私有规则将作为会话草稿保留，再次开启时可继续使用；关闭标签页或浏览器后草稿会被清除。
                          </Text>
                          {!isDevToolsContext ? (
                            <Text type="warning">
                              请从目标页面的 DevTools → Resource Override 面板管理当前标签页的独立规则。
                            </Text>
                          ) : privateRulesEnabled ? (
                            <Text type="success">
                              当前标签页正在使用独立规则，其他标签页不会受到这里的规则编辑影响。
                            </Text>
                          ) : hasPrivateDraft ? (
                            <Text type="warning">
                              当前标签页正在使用全局规则；已保留一份私有规则草稿，再次开启可恢复。
                            </Text>
                          ) : (
                            <Text type="secondary">当前标签页正在使用全局规则。</Text>
                          )}
                        </Space>
                      </Col>
                      <Col>
                        <Switch
                          checked={privateRulesEnabled}
                          disabled={!isDevToolsContext || scopeChanging}
                          loading={scopeChanging}
                          onChange={changePrivateRulesEnabled}
                          checkedChildren="开启"
                          unCheckedChildren="关闭"
                        />
                      </Col>
                    </Row>
                    {isDevToolsContext && (privateRulesEnabled || hasPrivateDraft) && (
                      <Space wrap>
                        {privateRulesEnabled && (
                          <Popconfirm
                            title="确定重置私有规则？"
                            description="当前标签页的私有规则将被最新全局规则覆盖。"
                            onConfirm={resetPrivateRules}
                          >
                            <Button disabled={scopeChanging}>重置为最新全局规则</Button>
                          </Popconfirm>
                        )}
                        {hasPrivateDraft && (
                          <Popconfirm
                            title="确定丢弃私有草稿？"
                            description="此操作无法撤销，当前标签页将使用全局规则。"
                            onConfirm={discardPrivateDraft}
                          >
                            <Button danger disabled={scopeChanging}>丢弃私有草稿</Button>
                          </Popconfirm>
                        )}
                      </Space>
                    )}
                    <Divider style={{ margin: 0 }} />
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space direction="vertical" size={0}>
                          <Text strong>显示调试日志</Text>
                          <Text type="secondary">在页面控制台中显示扩展的调试信息</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Switch
                          checked={showLogs}
                          onChange={handleLogsChange}
                          checkedChildren="开启"
                          unCheckedChildren="关闭"
                        />
                      </Col>
                    </Row>
                  </Space>
                </Card>

                <Card title="系统操作" size="small">
                  <Space wrap>
                    <Button 
                      type="primary" 
                      onClick={clearCache}
                    >
                      清理缓存
                    </Button>
                    <Button 
                      onClick={handleOpenExtensionManager}
                    >
                      扩展管理
                    </Button>
                  </Space>
                </Card>
              </Space>
            </TabPane>

            <TabPane tab="统计信息" key="stats">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Card title="规则统计" size="small">
                  <Row gutter={16}>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                          {ruleStats.dynamicRules}
                        </Title>
                        <Text type="secondary">动态规则</Text>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                          {ruleStats.sessionRules}
                        </Title>
                        <Text type="secondary">Session规则</Text>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <Title level={3} style={{ margin: 0, color: '#faad14' }}>
                          {ruleStats.activePrivateTabs}
                        </Title>
                        <Text type="secondary">独立规则Tab</Text>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div style={{ textAlign: 'center' }}>
                        <Title level={3} style={{ margin: 0, color: '#722ed1' }}>
                          {ruleStats.privateDraftTabs}
                        </Title>
                        <Text type="secondary">私有草稿Tab</Text>
                      </div>
                    </Col>
                  </Row>
                </Card>

                <Card title="版本信息" size="small">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row justify="space-between">
                      <Text>扩展版本:</Text>
                      <Tag color="blue">{version || '1.0.0'}</Tag>
                    </Row>
                    {installDate && (
                      <Row justify="space-between">
                        <Text>安装日期:</Text>
                        <Text type="secondary">{new Date(installDate).toLocaleDateString()}</Text>
                      </Row>
                    )}
                    {updateDate && (
                      <Row justify="space-between">
                        <Text>更新日期:</Text>
                        <Text type="secondary">{new Date(updateDate).toLocaleDateString()}</Text>
                      </Row>
                    )}
                    <Divider style={{ margin: '12px 0' }} />
                    <Paragraph type="secondary" style={{ margin: 0, fontSize: '12px' }}>
                      Resource Override 是一个功能强大的Chrome扩展，用于拦截和修改网络请求，
                      支持URL重定向、文件替换、头部修改等功能。
                    </Paragraph>
                  </Space>
                </Card>
              </Space>
            </TabPane>
          </Tabs>
        </Card>
      </Space>

      {/* 域名编辑模态框 */}
      <Modal
        title={editingDomain ? '编辑域名' : '添加域名'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDomainSubmit}
        >
          <Form.Item
            label="域名/URL匹配规则"
            name="url"
            rules={[{ required: true, message: '请输入域名或URL匹配规则' }]}
          >
            <Input placeholder="例如: *.example.com 或 https://example.com/*" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input placeholder="域名描述（可选）" />
          </Form.Item>
          <Form.Item
            label="启用状态"
            name="on"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则编辑模态框 */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={() => ruleForm.submit()}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          onFinish={handleRuleSubmit}
        >
          <Form.Item
            label="规则类型"
            name="type"
            rules={[{ required: true, message: '请选择规则类型' }]}
          >
            <Select placeholder="选择规则类型">
              <Option value="urlRedirect">URL重定向</Option>
              <Option value="fileOverride">文件替换</Option>
              <Option value="headerModification">头部修改</Option>
              <Option value="contentModification">内容修改</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="匹配规则"
            name="from"
            rules={[{ required: true, message: '请输入匹配规则' }]}
            extra="支持普通字符串、通配符 *，以及正则 /.../。URL重定向使用正则时，可在目标URL中引用 $1、$2。"
          >
            <Input placeholder="例如: /dist/(.*)/ 或 https://example.com/*.js" />
          </Form.Item>
          
          <Form.Item
            label="目标URL"
            name="to"
            dependencies={['type']}
            rules={[
              ({ getFieldValue }) => ({
                required: getFieldValue('type') === 'urlRedirect',
                message: '请输入目标URL',
              }),
            ]}
          >
            <Input placeholder="例如: http://localhost:8090/dist/$1" />
          </Form.Item>
          
          <Form.Item
            label="文件内容"
            name="file"
            dependencies={['type']}
            rules={[
              ({ getFieldValue }) => ({
                required: getFieldValue('type') === 'fileOverride',
                message: '请输入文件内容',
              }),
            ]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="替换的文件内容" 
            />
          </Form.Item>
          
          <Form.Item
            label="文件类型"
            name="fileType"
            dependencies={['type']}
          >
            <Select placeholder="选择文件类型">
              <Option value="js">JavaScript</Option>
              <Option value="css">CSS</Option>
              <Option value="html">HTML</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="描述"
            name="description"
          >
            <Input placeholder="规则描述（可选）" />
          </Form.Item>
          
          <Form.Item
            label="启用状态"
            name="on"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OptionsApp; 
 
