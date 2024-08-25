window.ssis = [];
window.isunlocked = false;
const renderJSON = function (json, container, indent = 0) {
    const keys = Object.keys(json);
    let html = '';

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = json[key];
        const type = typeof value;
        const isObject = type === 'object' && value !== null;
        const indentStr = '  '.repeat(indent);
        const nextIndent = isObject ? indent + 2 : indent;

        html += `<span class="key">${indentStr}${key}: </span>`;

        if (isObject) {
        html += `<span class="brace">${type === 'array' ? '[' : '{'}</span>\n`;
        html += renderJSON(value, container, nextIndent);
        html += `<span class="brace">${indentStr}${type === 'array' ? ']' : '}'}</span>\n`;
        } else {
        html += `<span class="value ${getTypeClass(type)}">${type === 'string' ? `"${value}"` : value}</span>\n`;
        }
    }

    container.innerHTML = html;
    return html;
}


const getTypeClass = function(type) {
    switch (type) {
        case 'number':
        return 'number';
        case 'string':
        return 'string';
        case 'boolean':
        return 'boolean';
        default:
        return '';
    }
}

const requireUnlock = async function(cb) {
    if(window.isunlocked) {
        cb($('#password').val());
        return;
    };
    const openInitial = function() {
        keyEntry(async function(key) {
            try {
                cryproProgress(0);
                $('#progressDecrypt').modal('show');
                const wallet = await window.TyDIDs.external.ethers.Wallet.fromEncryptedJson(window.ssis[0].jsonWallet,key,cryproProgress);
                $('#progressDecrypt').modal('hide');
                $('#wrongPassword').hide();
                window.isunlocked = true;
                cb(key);
            } catch(e) {
                $('#wrongPassword').show();
                $('#progressDecrypt').modal('hide');
                console.log(e);
                openInitial();
            }
        });
    }
    if(window.ssis.length > 0) openInitial(); else keyEntry(cb);

}
const keyEntry = async function(cb) {    
    if($('#password').val().length > 1) {
        cb($('#password').val());
    }

    $('#keyProtect').modal("show");    
    if(window.ssis.length > 0) {
        $('#confirmGroup').empty();
        $('#statusOpenCreate').html("Open");
        $('#btnOpenKey').html("Open");
    } else {
        $('#statusOpenCreate').html("Create");
        $('#btnOpenKey').html("Create");        
    }
    $('#keyForm').on('submit',async function(e) {
        e.preventDefault();               
        if(($('#password-confirmation').val() !== $('#password').val())&&(window.ssis.length == 0)) {
            alert("Passwords do not match");
        } else {
            $('#keyProtect').modal("hide");
            cb($('#password').val());
        }      
        $('#keyProtect').modal("hide");     
    });
}

const cryproProgress = function(progress) {
    progress = Math.round(100*progress);
    $('#progBarSecure').attr('aria-valuenow',progress);
    $('#progBarSecure').css('width',progress+"%");
    $('#progBarSecure').css('width',progress+"%");
    $('#progBarSecure').html(progress+"%");    
}

const syncBackend = async function() {
    if(!localStorage.getItem("device_key")) {
        const tmpWallet = window.TyDIDs.external.ethers.Wallet.createRandom();
        localStorage.setItem("device_key",tmpWallet.privateKey);
    }
    const envelopeWallet = new window.TyDIDs.external.ethers.Wallet(localStorage.getItem("device_key"));
    await receiveWalletBin(envelopeWallet.address,envelopeWallet.privateKey);
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(localStorage), envelopeWallet.privateKey).toString();
    const envelop = {
        id:envelopeWallet.address,
        payload:encryptedData
    }
    fetch('https://api.corrently.io/v2.0/stromdao/bin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelop)
    });
}


const receiveWalletBin = async function(id, privateKey) {
    try {
        // Abfrage der verschlüsselten Daten über den REST-Endpunkt
        const response = await fetch(`https://api.corrently.io/v2.0/stromdao/bin?id=${id}`);
        
        if (!response.ok) {
            throw new Error(`Error retrieving ConsentWallet: ${response.statusText}`);
        }

        const envelop = await response.json();

        // Verschlüsselte Daten entschlüsseln
        const bytes = CryptoJS.AES.decrypt(envelop.payload, privateKey);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

        // Entschlüsselte JSON-Daten wiederherstellen
        const data = JSON.parse(decryptedData);

        // Daten wieder ins localStorage laden (optional)
        Object.keys(data).forEach(key => {
            localStorage.setItem(key, data[key]);
        });        
    } catch (error) {
        // console.error("Error in ConsentWallet - Might be due to empty Bin", error);
    }
};

const openSSIModal = function () {
    // Handle the click event here
    const parent = this;              
    const data = JSON.parse(window.localStorage.getItem("ssi_"+$(this).attr('data')));        
    requireUnlock(async function(key) {                        
        $('#issuedAt').html(new Date(data["@iat"] * 1000).toLocaleString());
        let revokeString = "not revoked";                        
        if($(parent).attr("revocation") * 1 > 0) {
            $('#revokeSSI').attr('disabled','disabled');
            revokeString = new Date($(parent).attr("revocation") * 1000).toISOString();
        } else {
            $('#revokeSSI').removeAttr('disabled');
        }
        $('#revokedAt').html(revokeString);
        cryproProgress(0);
        setTimeout(function() {
            $('#progressDecrypt').modal('show');
        },500);            
        const wallet = await window.TyDIDs.external.ethers.Wallet.fromEncryptedJson(data.jsonWallet,key,cryproProgress);
        const ssi = new window.TyDIDs.SSI(wallet.privateKey);
        $('#progressDecrypt').modal('hide');            
        $('#unlockedID').html(wallet.address);
        $('#contextInfo').html(data["@context"].href);
        renderJSON(JSON.parse(data.payload),$("#ssiPayload")[0]);
        $('#revokeSSI').off();
        $('#revokeSSI').on('click',async function(e) {                
            $('#revokeSSI').attr('disabled','disabled');
            await ssi.revoke();  
            location.reload();                              
        });
        $('#modalSSI').modal('show');            
    });
}
const renderSSITable = async function()  {
    $('#ssiGroup').empty();
    window.ssis = window.ssis.sort((a, b) => b["@iat"] - a["@iat"]);
    for(let i=0;i<window.ssis.length;i++) {          
        const ssistatus = new window.TyDIDs.SSIStatus(window.ssis[i].identity);
        const identity = window.ssis[i].identity;

        ssistatus.isRevokedAt().then(function(revocation) {            
            $('[data="'+ssistatus.getIdentity()+'"]').prop('disabled', false); 
            $('[data="'+ssistatus.getIdentity()+'"]').attr('revocation',revocation);
           
            const revokeState = {
                display: new Date(revocation * 1000).toLocaleString(),
                id:window.ssis[i].identity
            }
            if(revocation == 0) {                                
             revokeState.display="-";
            } 
            const issueState = {
                display: new Date(window.ssis[i]["@iat"] * 1000).toLocaleString(),
                id:window.ssis[i].identity
            }

            
            // Draw with cards
            let html = `<div class="col-md-4" style="padding:3px;"><div class="card h-100" id="card_${window.ssis[i].identity}">
                <div class="card-header text-light text-truncate" style="background: #147a50;">
                <button class="btn btn-dark btn-sm ssiBtn" data="${window.ssis[i].identity}">
                 <svg class="bi bi-window" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1m2-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m1 .5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1"></path>
                    <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm13 2v2H1V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1M2 14a1 1 0 0 1-1-1V6h14v7a1 1 0 0 1-1 1z"></path>
                 </svg>
                </button>
                ${window.ssis[i]["@context"].href}
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col"><strong>Issued At:</strong><br/>${issueState.display}</div>
                        <div class="col"><strong>Revoked At:</strong><br/>${revokeState.display}</div>
                    </div>
                </div>
                <div class="card-footer text-truncate text-muted">${window.ssis[i].identity}</div>
            </div></div>`;

            $('#ssiGroup').append(html);
            $('.ssiBtn').off();
            $('.ssiBtn').on('click', openSSIModal);
        });                
    }

}

const processSSIContent = async function(content) {
    $('#modalAddSSI').modal('hide');
    const match = content.match(/<script type="application\/ld\+json" id="ssiObject">([\s\S]*?)<\/script>/);
    if (match && match[1]) {
    const ssiObject = JSON.parse(match[1]);                        
    const wallet = new window.TyDIDs.external.ethers.Wallet(ssiObject.privateKey);
    const existing = window.localStorage.getItem("ssi_"+ssiObject.identity);            
    delete ssiObject.privateKey;
    requireUnlock(async function(key) {                    
        cryproProgress(0);               
        setTimeout(function() {                   
            $('#progressDecrypt').modal('show');
        },500);  
        ssiObject.jsonWallet = await wallet.encrypt(key,{},cryproProgress);
        if((typeof existing == 'undefined') || ( existing == null)) window.ssis.push(ssiObject);
        window.localStorage.setItem("ssi_"+ssiObject.identity,JSON.stringify(ssiObject));
        $('#progressDecrypt').modal('hide');                
        $('#keyProtect').modal("hide");
        await syncBackend();
        renderSSITable();
    });
    } else {
    // open as tydidsWallet.json
    var data = JSON.parse(content);
    for (var key in data) {
        if (!localStorage.hasOwnProperty(key)) {
            localStorage.setItem(key, data[key]);
        }
    }
    location.reload();
    }
}

$(document).ready(async function() {
    await syncBackend();

    $('#btnScanQR').on('click',async function() {
        $('#modalKeyShare').modal('hide');
        $('#modalQR').modal('show');
        function onScanSuccess(decodedText, decodedResult) {            
            localStorage.setItem("device_key",decodedText);
            //location.reload();            
            $('#modalQR').modal('hide');        
        }
        function onScanFailure(error) {
          console.warn(`Code scan error = ${error}`);
        }
        let html5QrcodeScanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
              /* verbose= */ false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    });

    $('#btnDownloadStorage').on('click',async function() {  
        await syncBackend();
        const envelopeWallet = new window.TyDIDs.external.ethers.Wallet(localStorage.getItem("device_key"));
        $('#qrcode').html('');
        $('#qrAddress').val(envelopeWallet.address);        
        var qrcode = new QRCode(document.getElementById("qrcode"), {
            text: envelopeWallet.privateKey,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
        $('#modalKeyShare').modal('show');
    });
    $('#uploadSSI').on('change', function(e) {
        var file = e.target.files[0];
        var reader = new FileReader();
    
        reader.onload = async function(e) {
          const content = e.target.result;
          processSSIContent(content);
        };    
        reader.readAsText(file);
    });
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        let value = localStorage.getItem(key);
        if(key.indexOf("ssi_") == 0) {
            window.ssis.push(JSON.parse(value));
        }
    }
    if(window.ssis.length > 0 ) {            
        renderSSITable();
    }
    $('#btnAddSSI').on('click',() => { $('#modalAddSSI').modal('show'); })
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
}
async function processFile(fileHandle) {
    const file = await fileHandle.getFile();
  
    // Check if the file name starts with "ssi_"
    if (!file.name.startsWith("ssi_")) {
      console.log("File name does not meet the required criteria:", file.name);
      alert("Invalid file name. Please upload an HTML file that starts with 'ssi_'.");
      return;
    }
  
    // If the file name is valid, proceed to read its content
    const content = await file.text();
    processSSIContent(content);
}

if ('launchQueue' in window) {
    window.launchQueue.setConsumer((launchParams) => {
      if (!launchParams.files.length) {
        return;
      }
  
      for (const fileHandle of launchParams.files) {
        processFile(fileHandle);
      }
    });
}