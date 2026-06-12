
    <pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="codes">
        <!-- versiunea v1.0.4 din 17.04.2026  modificat [CD-D212-015]: s-a adaugat valoarea 1026- Exploatarea de catre mostenitori a drepturilor de proprietate intelectuala/remuneratie reprezentand dreptul de suita / remuneratie compensatorie pentru copia privatã -->
        <!-- versiunea v1.0.3 din 24.03.2026  actualizar lista de tari. ISO full + teritorii, regiuni speciale sau coduri ISO extinse + XK(Kosovo nu este oficial ISO-3166, dar folosit frecvent în practică) + XI(Irlanda de Nord - cod rezervat -  are regim special pentru TVA) --> 
        <!-- versiunea v1.0.2 din 09.03.2026 adaugat 'CW' , 'HK' , 'BM', 'GI' in lista de tari --> 
        <!-- versiunea v1.0.1 din 12.02.2026 adaugat 'IM' , 'GG' , 'JE' in lista de tari  si valoarea 6 in statut  ∈ {1,2,3,4,5,6}--> 
        <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
        <title>D212 – Codes validation </title>
        <!-- load external nomenclator CAEN (file in same folder as this schematron) 
        <let name="nomenclator_caen" value="doc('nomenclator_caen.xml')"/>
        -->
        <!-- ===========================
         1. BIFE & FLAG-URI (0/1, 1, 1/2 etc.)
       =========================== -->
        
        <!-- CD-D212-001: bifa*, rectif, ... in {0,1} -->
        <!-- CD-D212-002: bifa_optiune, bifa_optiune_coasigurat = 1 -->
        <!-- CD-D212-003: tipCoasigurat, det_ven_net, norma_forma_org in {1,2} -->
        <!-- CD-D212-004: forma_org in {1,2,3,4} -->
        <!-- CD-D212-005: bifa_cass_real in {0,1,2,3} -->
        <!-- CD-D212-006: dubla_impunere in {1,2,4} -->
        <!-- CD-D212-007: estan_forma_org in {1,2,3} -->
        <!-- CD-D212-019: statut in {1..5} -->
        <!-- CD-D212-020: bifa_cas_real in {0,1,2} -->
        
        
        <!-- ===========================
         2. ENUM-URI NUMERICE MICI
       =========================== -->
        
        <!-- CD-D212-008: norma_sector 1..6 -->
        <!-- CD-D212-009: str_cass_pensie_luna 1..12 -->
        <!-- CD-D212-010: norma_judet, estan_judet_activ in {1..40,51,52} -->
        <!-- CD-D212-017: tip_chirie ∈ {1,2,3,4}-->
        <!-- CD-D212-018: situatie_optiune ∈ {A,B,C,D,E,F}-->
        
        <!-- ===========================
         3. CODURI TERITORIALE / TARI
       =========================== -->
        
        <!-- CD-D212-011: str_stat_realiz_v, str_cass_pensie_tara ISO3166 A-2 -->
        
        <!-- ===========================
         4. CODURI ECONOMICE / FISCALE
       =========================== -->
        
        <!-- CD-D212-012: caen, norma_caen (CAEN Rev.2/3) -->
        <!-- CD-D212-013: codp (produse vegetale/animale) -->
        <!-- CD-D212-014: criteriu (corecție) -->
        <!-- CD-D212-015: categ_venit (venituri RO) -->
        <!-- CD-D212-016: str_categ_venit (venituri STR) -->
        
    <!-- Atributele de tip bifa trebuie sa fie 0 sau 1 -->
        <!-- Regula: bifa  + norma_isPGL, reg, scutire, nerezident, anulare_litA, anulare_litB, rectif1, rectif2, d_rec, estan_incadrare_neimpoz    ∈ {0,1} -->
        <rule context="//@*[
            (starts-with(name(.), 'bifa')
            and not(name(.) = ('bifa_cas_real',
            'bifa_cass_real',
            'bifa_optiune',
            'bifa_optiune_coasigurat')))
            or name(.) = ('norma_isPGL','reg','scutire','nerezident', 'anulare_litA', 'anulare_litB', 'rectif1', 'rectif2', 'd_rec', 'estan_incadrare_neimpoz')
            ]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '0' or . = '1'"
                flag="fatal"
                id="CD-D212-001">
                [CD-D212-001] <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 0 sau 1.
            </assert>
        </rule>
        <!-- Regula: bifa_optiune, bifa_optiune_coasigutat  ∈ {1} -->
        <rule context="//@*[name(.) = ('bifa_optiune','bifa_optiune_coasigurat')]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1'"
                flag="fatal"
                id="CD-D212-002">
                [CD-D212-002]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1.
            </assert>
        </rule>
        <!-- Regula: tipCoasigurat, det_ven_net, norma_forma_org  ∈ {1,2} -->
        <rule context="//@*[name(.) = ('tipCoasigurat',
            'det_ven_net',
            'norma_forma_org')]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2'"
                flag="fatal"
                id="CD-D212-003">
                [CD-D212-003]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1 sau 2.
            </assert>
        </rule>
        <!-- Regula: forma_org  ∈ {1,2,3,4} -->
        <rule context="//@*[name(.) = 'forma_org']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '3' or . = '4'"
                flag="fatal"
                id="CD-D212-004">
                [CD-D212-004]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1, 2, 3 sau 4.
            </assert>
            
        </rule>
        <!-- Regula: bifa_cass_real  ∈ {0,1,2,3} -->
        <rule context="//@*[name(.) = 'bifa_cass_real']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '0' or . = '1' or . = '2' or . = '3'"
                flag="fatal"
                id="CD-D212-005">
                [CD-D212-005]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 0, 1, 2 sau 3.
            </assert>
            
        </rule>
        <!-- Regula: dubla_impunere  ∈ {1,2,4} -->
        <rule context="//@*[name(.) = 'dubla_impunere']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '4'"
                flag="fatal"
                id="CD-D212-006">
                [CD-D212-006]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1, 2 sau 4.
            </assert>
            
        </rule>
        <!-- Regula: estan_forma_org  ∈ {1,2,3} -->
        <rule context="//@*[name(.) = 'estan_forma_org']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '3'"
                flag="fatal"
                id="CD-D212-007">
                [CD-D212-007]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1, 2 sau 3.
            </assert>
            
        </rule>
        <!-- Regula: str_cass_pensie_luna  ∈ {1,2,3,4,5,6,7,8,9,10,11,12} -->
        <rule context="//@*[name(.) = 'str_cass_pensie_luna']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". castable as xs:integer
                and number(.) &gt;= 1
                and number(.) &lt;= 12"
                flag="fatal"
                id="CD-D212-009">
                [CD-D212-009]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba o valoare intre 1 si 12 (numar intreg).
            </assert>
            
        </rule>
        <!-- Regula: norma_judet, estan_judet_activ ∈ Nomenclator_judete -->
        <rule context="//@*[name(.) = ('norma_judet','estan_judet_activ')]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". castable as xs:integer
                and number(.) = (
                1,2,3,4,5,6,7,8,9,10,
                11,12,13,14,15,16,17,18,19,20,
                21,22,23,24,25,26,27,28,29,30,
                31,32,33,34,35,36,37,38,39,40,
                51,52
                )"
                flag="fatal"
                id="CD-D212-010">
                [CD-D212-010]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod numeric de judet valid
                (1–40, 51 sau 52).
            </assert>
            
        </rule>
        <!-- Regula: str_stat_realiz_v, str_cass_pensie_tara, stat_rezidenta ∈ Nomenclator_tari (ISO3166 A-2)-->
        <rule context="//@*[name(.) = ('str_stat_realiz_v','str_cass_pensie_tara', 'stat_rezidenta')]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". = (
                'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
                'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
                'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
                'DE','DJ','DK','DM','DO','DZ',
                'EC','EE','EG','EH','ER','ES','ET',
                'FI','FJ','FK','FM','FO','FR',
                'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
                'HK','HM','HN','HR','HT','HU',
                'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
                'JE','JM','JO','JP',
                'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
                'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
                'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
                'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
                'OM',
                'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
                'QA',
                'RE','RO','RS','RU','RW',
                'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
                'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
                'UA','UG','UM','US','UY','UZ',
                'VA','VC','VE','VG','VI','VN','VU',
                'WF','WS',
                'XI','XK',
                'YE','YT',
                'ZA','ZM','ZW'
                )"
                flag="fatal"
                id="CD-D212-011">
                [CD-D212-011]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod de tara valid
                conform standardului ISO 3166-1 Alpha-2 (de exemplu RO pentru Romania, DE pentru Germania).
            </assert>
            
        </rule>
        <!-- Regula: caen, norma_caen ∈ Nomenclator_caen (tolerant la namespace si fara ambiguitate . in predicat) -->
        <rule context="//@*[name(.) = ('norma_caen','caen')]">
            <let name="attName" value="name(.)"/>
            <let name="attVal"  value="normalize-space(.)"/>
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
            <assert
                test="exists($caen//*[local-name() = 'cod' and normalize-space(@value) = $attVal])"
                flag="fatal"
                id="CD-D212-012">
                [CD-D212-012]
                <value-of select="if (normalize-space($desc) != '') then $desc else $attName"/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod CAEN valid (conform Nomenclator CAEN Rev.2/Rev.3).
            </assert>
        </rule>
        <!-- Regula: codp ∈ Nomenclator_produseVegetale si Nomenclator_animale (101–116, 201–207) -->
        <rule context="//@*[name(.) = 'codp']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". = (
                '101','102','103','104','105','106','107','108','109','110',
                '111','112','113','114','115','116',
                '201','202','203','204','205','206','207'
                )"
                flag="fatal"
                id="CD-D212-013">
                [CD-D212-013]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod valid din Nomenclatorul de produse vegetale(101–116) sau animale(201–207).
            </assert>
            
        </rule>
        <!-- Regula: criteriu ∈ Nomenclator_corectie -->
        <rule context="//@*[name(.) = 'criteriu']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". = (
                '01','02','0201','0202','0203','0204',
                '03','04','0401','0402','05','06',
                '07','08','09','10','11','12','13',
                '1301','1302','1303'
                )"
                flag="fatal"
                id="CD-D212-014">
                
                [CD-D212-014]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod valid din Nomenclator_corectie.
                
            </assert>
            
        </rule>
        <!-- Regula: categ_venit ∈ Nomenclator_venituri_RO -->
        <rule context="//@*[name(.) = 'categ_venit']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". = (
                '1016','1003','1006','1015',
                '1009','1010','1011','1012',
                '1025','1021','1022','1023','1024','1026'
                )"
                flag="fatal"
                id="CD-D212-015">
                [CD-D212-015]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod valid din Nomenclator_venituri_RO.
            </assert>
            
        </rule>
        <!-- Regula: str_categ_venit ∈ Nomenclator_venituri_STR -->
        <rule context="//@*[name(.) = 'str_categ_venit']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert
                test=". = (
                '2027','2003','2004','2009','2010','2011','2017','2018',
                '2012','2028','2015','2020','2016','2025','2013','2029',
                '2030','2024','2014'
                )"
                flag="fatal"
                id="CD-D212-016">
                [CD-D212-016]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa contina un cod valid din Nomenclator_venituri_STR.
            </assert>
            
        </rule>
        <!-- Regula: tip_chirie  ∈ {1,2,3,4} -->
        <rule context="//@*[name(.) = 'tip_chirie']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '3' or . = '4'"
                flag="fatal"
                id="CD-D212-017">
                [CD-D212-017]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1, 2, 3 sau 4.
            </assert>
            
        </rule>    
        <!-- Regula: situatie_optiune  ∈ {A,B,C,D,E,F} -->
        <rule context="//@*[name(.) = 'situatie_optiune']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = 'A' or . = 'B' or . = 'C' or . = 'D' or . = 'E' or . = 'F'"
                flag="fatal"
                id="CD-D212-018">
                [CD-D212-018]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea A, B, C, D, E sau F.
            </assert>
            
        </rule>  
        <!-- Regula: statut  ∈ {1,2,3,4,5,6} -->
        <rule context="//@*[name(.) = 'statut']">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '3' or . = '4' or . = '5' or . = '6'"
                flag="fatal"
                id="CD-D212-019">
                [CD-D212-019]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 1, 2, 3, 4 sau 5.
            </assert>
            
        </rule> 
        <!-- Regula: bifa_cas_real ∈ {0,1,2} -->
        <rule context="//@*[name(.) = ('bifa_cas_real')]">
            
            <let name="attName" value="name(.)"/>
            
            <let name="desc"
                value="$schema//xs:attribute[@name = $attName]
                /xs:annotation/xs:documentation[1]"/>
            
            <assert test=". = '1' or . = '2' or . = '0'"
                flag="fatal"
                id="CD-D212-020">
                [CD-D212-020]
                <value-of select="
                    if (normalize-space($desc) != '')
                    then $desc
                    else $attName
                    "/>
                (<value-of select="$attName"/>)
                din elementul <value-of select="name(..)"/>
                trebuie sa aiba valoarea 0,1 sau 2.
            </assert>
        </rule>
    <!--
      Aici poti adauga ulterior alte reguli de coduri:
      Folosind acelasi tip de mesaj: Descriere (nume) ...
    -->
</pattern>