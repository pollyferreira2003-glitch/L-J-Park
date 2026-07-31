(() => {
  'use strict';

  const apiUrl = window.APP_CONFIG?.API_URL || '';
  const $ = id => document.getElementById(id);

  console.info('L&J Admin V5 carregado');

  const adminForm = $('adminForm');
  const login = $('adminLogin');
  const dashboard = $('dashboard');
  const message = $('adminMessage');

  const tbody = $('bookingsTable');
  const empty = $('emptyState');

  const productForm = $('productForm');
  const productName = $('productName');
  const productPrice = $('productPrice');
  const productStock = $('productStock');
  const productsTable = $('productsTable');
  const productsEmpty = $('productsEmpty');
  const productMessage = $('productMessage');
  const saveProductButton = $('saveProductButton');
  const cancelProductEdit = $('cancelProductEdit');

  let token = '';
  let bookings = [];
  let products = [];
  let reportRows = [];
  let editingProductId = '';
  let duplicatingBooking = null;

  const duplicateModal = $('duplicateModal');
  const duplicateForm = $('duplicateForm');
  const duplicateDate = $('duplicateDate');
  const duplicateTime = $('duplicateTime');
  const duplicateBookingInfo = $('duplicateBookingInfo');
  const duplicateMessage = $('duplicateMessage');
  const confirmDuplicateButton = $('confirmDuplicateButton');
  const cancelDuplicateButton = $('cancelDuplicateButton');
  const closeDuplicateButton = $('closeDuplicateButton');

  if (!adminForm) {
    console.error('O formulário adminForm não foi encontrado no admin.html.');
    return;
  }

  adminForm.addEventListener('submit', async event => {
    event.preventDefault();

    const tokenField = $('adminToken');
    token = tokenField ? tokenField.value.trim() : '';

    if (!token) {
      show('Digite a senha administrativa.', 'error');
      return;
    }

    await load();
  });

  $('refreshButton')?.addEventListener('click', load);
  $('filterDate')?.addEventListener('input', renderTable);
  $('filterSearch')?.addEventListener('input', renderTable);
  $('generateReport')?.addEventListener('click', generateReport);
  $('exportCsv')?.addEventListener('click', exportCsv);

  productForm?.addEventListener('submit', saveProduct);
  cancelProductEdit?.addEventListener('click', () => resetProductForm());

  duplicateForm?.addEventListener('submit', confirmDuplicateBooking);
  cancelDuplicateButton?.addEventListener('click', closeDuplicateModal);
  closeDuplicateButton?.addEventListener('click', closeDuplicateModal);

  duplicateModal?.addEventListener('click', event => {
    if (event.target === duplicateModal) {
      closeDuplicateModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && duplicateModal && !duplicateModal.classList.contains('hidden')) {
      closeDuplicateModal();
    }
  });

  async function load() {
    show('Carregando dados...', '');

    try {
      const bookingResult = await jsonp({
        action: 'admin',
        token
      });

      if (!bookingResult.success) {
        throw new Error(
          bookingResult.message || 'Senha administrativa incorreta.'
        );
      }

      bookings = Array.isArray(bookingResult.bookings)
        ? bookingResult.bookings
        : [];

      login?.classList.add('hidden');
      dashboard?.classList.remove('hidden');

      show('', '');

      updateDashboard();
      setDefaultReportDates();
      generateReport();
      renderTable();

      loadProductsWithoutBlockingPanel();

    } catch (error) {
      show(
        error.message || 'Não foi possível entrar no painel.',
        'error'
      );
    }
  }

  async function loadProductsWithoutBlockingPanel() {
    if (!productsTable) return;

    try {
      const result = await jsonp({
        action: 'listProductsAdmin',
        token
      });

      if (!result.success) {
        throw new Error(
          result.message || 'Não foi possível carregar os produtos.'
        );
      }

      products = Array.isArray(result.products)
        ? result.products
        : [];

      renderProducts();
      showProductMessage('', '');

    } catch (error) {
      products = [];
      renderProducts();

      showProductMessage(
        'O painel abriu, mas não foi possível carregar os produtos.',
        'error'
      );
    }
  }

  async function saveProduct(event) {
    event.preventDefault();

    const nome = productName?.value.trim() || '';
    const valor = Number(productPrice?.value || 0);
    const estoque = Number(productStock?.value || 0);

    if (!nome) {
      showProductMessage('Informe o nome do produto.', 'error');
      return;
    }

    if (!Number.isFinite(valor) || valor < 0) {
      showProductMessage('Informe um valor válido.', 'error');
      return;
    }

    if (!Number.isInteger(estoque) || estoque < 0) {
      showProductMessage('Informe uma quantidade válida.', 'error');
      return;
    }

    if (saveProductButton) {
      saveProductButton.disabled = true;
    }

    showProductMessage('Salvando produto...', '');

    try {
      const wasEditing = Boolean(editingProductId);

      const result = await jsonp({
        action: wasEditing ? 'updateProduct' : 'createProduct',
        token,
        id: editingProductId,
        nome,
        valor: String(valor),
        estoque: String(estoque)
      });

      if (!result.success) {
        throw new Error(
          result.message || 'Não foi possível salvar o produto.'
        );
      }

      products = Array.isArray(result.products)
        ? result.products
        : products;

      renderProducts();
      resetProductForm(false);

      showProductMessage(
        wasEditing
          ? 'Produto atualizado com sucesso.'
          : 'Produto cadastrado com sucesso.',
        'success'
      );

    } catch (error) {
      showProductMessage(
        error.message || 'Não foi possível salvar o produto.',
        'error'
      );

    } finally {
      if (saveProductButton) {
        saveProductButton.disabled = false;
      }
    }
  }

  function renderProducts() {
    if (!productsTable) return;

    productsTable.innerHTML = '';

    if (productsEmpty) {
      productsEmpty.classList.toggle('hidden', products.length > 0);
    }

    products
      .slice()
      .sort((a, b) =>
        String(a.nome).localeCompare(String(b.nome), 'pt-BR')
      )
      .forEach(product => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = product.nome || '—';

        const priceCell = document.createElement('td');
        priceCell.textContent = money(product.valor);

        const stockCell = document.createElement('td');
        stockCell.textContent = String(Number(product.estoque || 0));

        const statusCell = document.createElement('td');
        const status = document.createElement('span');
        const available = Number(product.estoque || 0) > 0;

        status.className = available
          ? 'product-status available'
          : 'product-status sold-out';

        status.textContent = available
          ? 'Disponível'
          : 'Esgotado';

        statusCell.appendChild(status);

        const actionsCell = document.createElement('td');
        const actions = document.createElement('div');
        actions.className = 'product-action-buttons';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'product-edit-button';
        editButton.textContent = 'Editar';
        editButton.addEventListener('click', () =>
          beginProductEdit(product)
        );

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'product-delete-button';
        deleteButton.textContent = 'Excluir';
        deleteButton.addEventListener('click', () =>
          deleteProduct(product)
        );

        actions.append(editButton, deleteButton);
        actionsCell.appendChild(actions);

        row.append(
          nameCell,
          priceCell,
          stockCell,
          statusCell,
          actionsCell
        );

        productsTable.appendChild(row);
      });
  }

  function beginProductEdit(product) {
    editingProductId = String(product.id || '');

    if (productName) {
      productName.value = product.nome || '';
    }

    if (productPrice) {
      productPrice.value = Number(product.valor || 0).toFixed(2);
    }

    if (productStock) {
      productStock.value = Number(product.estoque || 0);
    }

    if (saveProductButton) {
      saveProductButton.textContent = 'Salvar alterações';
    }

    cancelProductEdit?.classList.remove('hidden');

    showProductMessage('Editando produto.', '');
    productName?.focus();
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `Excluir o produto "${product.nome}"?`
    );

    if (!confirmed) return;

    showProductMessage('Excluindo produto...', '');

    try {
      const result = await jsonp({
        action: 'deleteProduct',
        token,
        id: String(product.id || '')
      });

      if (!result.success) {
        throw new Error(
          result.message || 'Não foi possível excluir o produto.'
        );
      }

      products = Array.isArray(result.products)
        ? result.products
        : products.filter(item =>
            String(item.id) !== String(product.id)
          );

      if (String(editingProductId) === String(product.id)) {
        resetProductForm(false);
      }

      renderProducts();

      showProductMessage(
        'Produto excluído com sucesso.',
        'success'
      );

    } catch (error) {
      showProductMessage(
        error.message || 'Não foi possível excluir o produto.',
        'error'
      );
    }
  }

  function resetProductForm(clearMessage = true) {
    editingProductId = '';

    productForm?.reset();

    if (saveProductButton) {
      saveProductButton.textContent = 'Cadastrar produto';
    }

    cancelProductEdit?.classList.add('hidden');

    if (clearMessage) {
      showProductMessage('', '');
    }
  }

  function showProductMessage(text, type) {
    if (!productMessage) return;

    productMessage.className = `product-message ${type || ''}`;
    productMessage.textContent = text;
  }

  function updateDashboard() {
    const today = localISO(new Date());
    const completed = bookings.filter(isCompleted);

    setText('totalBookings', bookings.length);
    setText('washedBookings', completed.length);

    setText(
      'todayBookings',
      bookings.filter(item => item.dataISO === today).length
    );

    setText(
      'completedRevenue',
      money(
        completed.reduce(
          (sum, item) => sum + Number(item.valor || 0),
          0
        )
      )
    );
  }

  function setDefaultReportDates() {
    const start = $('reportStart');
    const end = $('reportEnd');

    if (!start || !end || start.value || end.value) {
      return;
    }

    const now = new Date();

    start.value = localISO(
      new Date(now.getFullYear(), now.getMonth(), 1)
    );

    end.value = localISO(
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
    );
  }

  function generateReport() {
    const start = $('reportStart')?.value || '';
    const end = $('reportEnd')?.value || '';
    const status = $('reportStatus')?.value || '';

    if (start && end && start > end) {
      window.alert(
        'A data inicial não pode ser maior que a data final.'
      );
      return;
    }

    reportRows = bookings.filter(item =>
      (!start || item.dataISO >= start) &&
      (!end || item.dataISO <= end) &&
      (!status || normalize(item.status) === normalize(status))
    );

    const completed = reportRows.filter(isCompleted);

    const unpaid = reportRows.filter(
      item => normalize(item.status) === 'nao pagou'
    );

    setText('reportTotal', reportRows.length);
    setText('reportWashed', completed.length);

    setText(
      'reportCanceled',
      reportRows.filter(
        item => normalize(item.status) === 'cancelado'
      ).length
    );

    setText(
      'reportUnpaid',
      `${unpaid.length} registro(s) com status Não Pagou`
    );

    setText(
      'reportUnpaidValue',
      money(
        unpaid.reduce(
          (sum, item) => sum + Number(item.valor || 0),
          0
        )
      )
    );

    setText(
      'reportRevenue',
      money(
        completed.reduce(
          (sum, item) => sum + Number(item.valor || 0),
          0
        )
      )
    );
  }

  function renderTable() {
    if (!tbody) return;

    const query = normalize($('filterSearch')?.value || '');
    const date = $('filterDate')?.value || '';

    const filtered = bookings.filter(item =>
      (!date || item.dataISO === date) &&
      (
        !query ||
        normalize([
          item.protocolo,
          item.nome,
          item.telefone,
          item.modelo,
          item.placa,
          item.localVeiculo,
          item.status
        ].join(' ')).includes(query)
      )
    );

    tbody.innerHTML = '';

    if (empty) {
      empty.classList.toggle('hidden', filtered.length > 0);
    }

    filtered.forEach(item => {
      const row = document.createElement('tr');

      const values = [
        item.protocolo,
        item.data,
        item.horarioSaida,
        item.nome,
        item.telefone,
        item.modelo,
        item.placa,
        item.porte,
        item.localVeiculo,
        item.tipoLavagem,
        item.valorFormatado || money(item.valor),
        item.observacoes,
        item.status
      ];

      values.forEach((value, index) => {
        const cell = document.createElement('td');

        if (index === 12) {
          const badge = document.createElement('span');
          badge.className =
            `status-badge ${statusClass(value)}`;
          badge.textContent = value || 'Agendado';
          cell.appendChild(badge);

        } else {
          cell.textContent = value || '—';
        }

        row.appendChild(cell);
      });

      const actionCell = document.createElement('td');
      actionCell.className = 'action-cell';

      const select = document.createElement('select');
      select.className = 'status-select';

      [
        'Agendado',
        'Em andamento',
        'Não Pagou',
        'Concluído',
        'Cancelado'
      ].forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        option.selected =
          normalize(item.status) === normalize(status);

        select.appendChild(option);
      });

      select.addEventListener('change', async () => {
        const previous = item.status;
        select.disabled = true;

        try {
          const result = await jsonp({
            action: 'updateStatus',
            token,
            protocolo: item.protocolo,
            status: select.value
          });

          if (!result.success) {
            throw new Error(
              result.message || 'Não foi possível atualizar.'
            );
          }

          item.status = select.value;

          updateDashboard();
          generateReport();
          renderTable();

        } catch (error) {
          select.value = previous;

          window.alert(
            error.message ||
            'Não foi possível atualizar o status.'
          );

        } finally {
          select.disabled = false;
        }
      });

      const actionWrapper = document.createElement('div');
      actionWrapper.className = 'booking-action-buttons';

      const duplicateButton = document.createElement('button');
      duplicateButton.type = 'button';
      duplicateButton.className = 'duplicate-booking-button';
      duplicateButton.textContent = 'Duplicar';
      duplicateButton.title = 'Criar outro agendamento com os mesmos dados';
      duplicateButton.addEventListener('click', () => openDuplicateModal(item));

      actionWrapper.append(select, duplicateButton);
      actionCell.appendChild(actionWrapper);
      row.appendChild(actionCell);

      const registeredCell = document.createElement('td');
      registeredCell.textContent = item.registradoEm || '—';
      row.appendChild(registeredCell);

      tbody.appendChild(row);
    });
  }

  function openDuplicateModal(item) {
    if (!duplicateModal || !duplicateForm || !duplicateDate || !duplicateTime) {
      window.alert('A janela de duplicação não foi encontrada no admin.html.');
      return;
    }

    duplicatingBooking = item;

    duplicateForm.reset();
    duplicateMessage.textContent = '';
    duplicateMessage.className = 'duplicate-message';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    duplicateDate.min = localISO(new Date());
    duplicateDate.value = item.dataISO && item.dataISO >= duplicateDate.min
      ? item.dataISO
      : localISO(tomorrow);

    duplicateTime.value = item.horarioSaida || '';

    if (duplicateBookingInfo) {
      duplicateBookingInfo.textContent =
        `${item.nome || 'Cliente'} • ${item.modelo || 'Veículo'} • ${item.placa || 'Sem placa'}`;
    }

    duplicateModal.classList.remove('hidden');
    duplicateModal.setAttribute('aria-hidden', 'false');

    setTimeout(() => duplicateDate.focus(), 50);
  }

  function closeDuplicateModal() {
    if (!duplicateModal) return;

    duplicateModal.classList.add('hidden');
    duplicateModal.setAttribute('aria-hidden', 'true');
    duplicatingBooking = null;

    if (duplicateForm) duplicateForm.reset();
    if (duplicateMessage) {
      duplicateMessage.textContent = '';
      duplicateMessage.className = 'duplicate-message';
    }
  }

  async function confirmDuplicateBooking(event) {
    event.preventDefault();

    if (!duplicatingBooking) {
      showDuplicateMessage('Selecione um agendamento para duplicar.', 'error');
      return;
    }

    const newDate = duplicateDate?.value || '';
    const newTime = duplicateTime?.value || '';

    if (!newDate || !newTime) {
      showDuplicateMessage('Informe a nova data e o novo horário.', 'error');
      return;
    }

    if (newDate < localISO(new Date())) {
      showDuplicateMessage('A nova data não pode estar no passado.', 'error');
      return;
    }

    if (confirmDuplicateButton) {
      confirmDuplicateButton.disabled = true;
      confirmDuplicateButton.textContent = 'Criando...';
    }

    showDuplicateMessage('Criando novo agendamento...', '');

    try {
      const item = duplicatingBooking;

      const result = await jsonp({
        action: 'duplicateBooking',
        token,
        protocolo: item.protocolo || '',
        data: newDate,
        horarioSaida: newTime
      }, 30000);

      if (!result.success) {
        throw new Error(
          result.message || 'Não foi possível duplicar o agendamento.'
        );
      }

      showDuplicateMessage(
        `Novo agendamento criado com sucesso. Protocolo: ${result.protocolo || 'gerado'}.`,
        'success'
      );

      await load();

      setTimeout(closeDuplicateModal, 1200);

    } catch (error) {
      showDuplicateMessage(
        error.message || 'Não foi possível duplicar o agendamento.',
        'error'
      );

    } finally {
      if (confirmDuplicateButton) {
        confirmDuplicateButton.disabled = false;
        confirmDuplicateButton.textContent = 'Criar novo agendamento';
      }
    }
  }

  function showDuplicateMessage(text, type) {
    if (!duplicateMessage) return;

    duplicateMessage.className = `duplicate-message ${type || ''}`;
    duplicateMessage.textContent = text;
  }

  function exportCsv() {
    generateReport();

    if (!reportRows.length) {
      window.alert(
        'Não há registros para extrair nesse período.'
      );
      return;
    }

    const headers = [
      'Data e Hora do Registro',
      'Protocolo',
      'Nome e Sobrenome',
      'Telefone',
      'Modelo do Veículo',
      'Placa',
      'Porte',
      'Local do Veículo',
      'Data da Lavagem',
      'Horário de Saída',
      'Tipo de Lavagem',
      'Valor',
      'Observação',
      'Status'
    ];

    const rows = reportRows.map(item => [
      item.registradoEm,
      item.protocolo,
      item.nome,
      item.telefone,
      item.modelo,
      item.placa,
      item.porte,
      item.localVeiculo,
      item.data,
      item.horarioSaida,
      item.tipoLavagem,
      Number(item.valor || 0).toFixed(2).replace('.', ','),
      item.observacoes,
      item.status
    ]);

    const csv = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(csvCell).join(';'))
      .join('\r\n');

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download =
      `relatorio-lavagens-${
        $('reportStart')?.value || 'inicio'
      }-a-${
        $('reportEnd')?.value || 'fim'
      }.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(anchor.href);
  }

  function jsonp(params, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      if (!apiUrl) {
        reject(
          new Error(
            'A URL do Apps Script não foi configurada no config.js.'
          )
        );
        return;
      }

      const callbackName =
        `__lja_${Date.now()}_${
          Math.random().toString(36).slice(2)
        }`;

      const script = document.createElement('script');

      const timer = setTimeout(
        () =>
          cleanup(
            new Error('Não foi possível carregar os dados.')
          ),
        timeoutMs
      );

      function cleanup(error, data) {
        clearTimeout(timer);

        try {
          delete window[callbackName];
        } catch (_) {
          window[callbackName] = undefined;
        }

        script.remove();

        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      }

      window[callbackName] = data =>
        cleanup(null, data);

      script.onerror = () =>
        cleanup(
          new Error('Não foi possível carregar os dados.')
        );

      script.src =
        `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${
          new URLSearchParams({
            ...params,
            callback: callbackName,
            _: Date.now().toString()
          })
        }`;

      document.head.appendChild(script);
    });
  }

  function statusClass(value) {
    const status = normalize(value).replace(/\s+/g, '');

    if (status === 'emandamento') return 'andamento';
    if (status === 'naopagou') return 'naopago';
    if (status === 'concluido') return 'concluido';
    if (status === 'cancelado') return 'cancelado';

    return 'agendado';
  }

  function isCompleted(item) {
    return ['concluido', 'lavado'].includes(
      normalize(item.status)
    );
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function money(value) {
    return Number(value || 0).toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    );
  }

  function localISO(date) {
    const offset = date.getTimezoneOffset();

    return new Date(
      date.getTime() - offset * 60000
    )
      .toISOString()
      .slice(0, 10);
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  function show(text, type) {
    if (!message) return;

    message.className = `message ${type || ''}`;
    message.textContent = text;
  }
})();